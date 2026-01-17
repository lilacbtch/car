from fastapi import FastAPI, APIRouter, Depends, HTTPException, UploadFile, File, Request, Response, Header
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import base64
from io import BytesIO
from PIL import Image
import pytesseract
import re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime

class SessionDataResponse(BaseModel):
    id: str
    email: str
    name: str
    picture: Optional[str]
    session_token: str

class Vehicle(BaseModel):
    vehicle_id: str
    brand: str
    model: str
    year: int
    base_price: float  # in TRY
    average_mileage: int
    category: str  # sedan, hatchback, suv, etc.
    image_base64: Optional[str] = None
    created_at: datetime

class ValuationRequest(BaseModel):
    brand: str
    model: str
    year: int
    mileage: int
    condition: str  # excellent, good, fair, poor

class ValuationResponse(BaseModel):
    estimated_value: float
    depreciation_percentage: float
    mileage_impact: float
    condition_factor: float
    market_trend: float
    breakdown: Dict[str, Any]

class SavedVehicle(BaseModel):
    saved_id: str
    user_id: str
    vehicle_id: str
    estimated_value: float
    valuation_data: Dict
    saved_at: datetime

class PriceTrend(BaseModel):
    vehicle_id: str
    brand: str
    model: str
    year: int
    price_history: List[Dict[str, Any]]  # [{date, price, mileage}]

class OCRRequest(BaseModel):
    image_base64: str

class SaveVehicleRequest(BaseModel):
    vehicle_id: str
    estimated_value: float
    valuation_data: Dict[str, Any]

# ==================== AUTHENTICATION ====================

async def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(None)
) -> User:
    """Get current authenticated user from session token"""
    session_token = None
    
    # Try to get from cookie first
    session_token = request.cookies.get("session_token")
    
    # Fallback to Authorization header
    if not session_token and authorization:
        if authorization.startswith("Bearer "):
            session_token = authorization.replace("Bearer ", "")
        else:
            session_token = authorization
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find session
    session = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry (timezone-aware)
    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Get user
    user_doc = await db.users.find_one(
        {"user_id": session["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(**user_doc)

@api_router.post("/auth/session")
async def exchange_session(request: Request, response: Response):
    """Exchange session_id for session_token"""
    session_id = request.headers.get("X-Session-ID")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session_id")
    
    # Call Emergent Auth API
    async with httpx.AsyncClient() as client:
        try:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id},
                timeout=10.0
            )
            auth_response.raise_for_status()
            user_data = auth_response.json()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to validate session: {str(e)}")
    
    # Create or get user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    existing_user = await db.users.find_one({"email": user_data["email"]}, {"_id": 0})
    
    if not existing_user:
        await db.users.insert_one({
            "user_id": user_id,
            "email": user_data["email"],
            "name": user_data["name"],
            "picture": user_data.get("picture"),
            "created_at": datetime.now(timezone.utc)
        })
    else:
        user_id = existing_user["user_id"]
    
    # Create session
    session_token = user_data["session_token"]
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    })
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="lax",
        max_age=7 * 24 * 60 * 60
    )
    
    return SessionDataResponse(**user_data)

@api_router.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user info"""
    return current_user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response, current_user: User = Depends(get_current_user)):
    """Logout user"""
    session_token = request.cookies.get("session_token")
    
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie("session_token")
    return {"message": "Logged out successfully"}

# ==================== VEHICLE DATA INITIALIZATION ====================

async def initialize_mock_data():
    """Initialize Turkish vehicle market mock data"""
    existing = await db.vehicles.count_documents({})
    if existing > 0:
        return
    
    # Turkish market popular vehicles with realistic 2024-2025 pricing in TRY
    mock_vehicles = [
        # Volkswagen
        {"brand": "Volkswagen", "model": "Golf", "year": 2024, "base_price": 1250000, "average_mileage": 5000, "category": "hatchback"},
        {"brand": "Volkswagen", "model": "Golf", "year": 2023, "base_price": 1100000, "average_mileage": 15000, "category": "hatchback"},
        {"brand": "Volkswagen", "model": "Golf", "year": 2022, "base_price": 950000, "average_mileage": 30000, "category": "hatchback"},
        {"brand": "Volkswagen", "model": "Passat", "year": 2024, "base_price": 1850000, "average_mileage": 8000, "category": "sedan"},
        {"brand": "Volkswagen", "model": "Passat", "year": 2023, "base_price": 1650000, "average_mileage": 20000, "category": "sedan"},
        {"brand": "Volkswagen", "model": "Passat", "year": 2021, "base_price": 1300000, "average_mileage": 45000, "category": "sedan"},
        {"brand": "Volkswagen", "model": "Polo", "year": 2024, "base_price": 950000, "average_mileage": 3000, "category": "hatchback"},
        {"brand": "Volkswagen", "model": "Polo", "year": 2023, "base_price": 850000, "average_mileage": 12000, "category": "hatchback"},
        {"brand": "Volkswagen", "model": "Polo", "year": 2022, "base_price": 720000, "average_mileage": 25000, "category": "hatchback"},
        {"brand": "Volkswagen", "model": "Tiguan", "year": 2024, "base_price": 2100000, "average_mileage": 6000, "category": "suv"},
        
        # Renault
        {"brand": "Renault", "model": "Megane", "year": 2024, "base_price": 1100000, "average_mileage": 4000, "category": "sedan"},
        {"brand": "Renault", "model": "Megane", "year": 2023, "base_price": 980000, "average_mileage": 18000, "category": "sedan"},
        {"brand": "Renault", "model": "Megane", "year": 2022, "base_price": 850000, "average_mileage": 32000, "category": "sedan"},
        {"brand": "Renault", "model": "Clio", "year": 2024, "base_price": 850000, "average_mileage": 2000, "category": "hatchback"},
        {"brand": "Renault", "model": "Clio", "year": 2023, "base_price": 750000, "average_mileage": 15000, "category": "hatchback"},
        {"brand": "Renault", "model": "Clio", "year": 2022, "base_price": 650000, "average_mileage": 28000, "category": "hatchback"},
        {"brand": "Renault", "model": "Clio", "year": 2021, "base_price": 550000, "average_mileage": 42000, "category": "hatchback"},
        {"brand": "Renault", "model": "Taliant", "year": 2024, "base_price": 920000, "average_mileage": 5000, "category": "sedan"},
        {"brand": "Renault", "model": "Austral", "year": 2024, "base_price": 1650000, "average_mileage": 7000, "category": "suv"},
        
        # Honda
        {"brand": "Honda", "model": "Civic", "year": 2024, "base_price": 1450000, "average_mileage": 6000, "category": "sedan"},
        {"brand": "Honda", "model": "Civic", "year": 2023, "base_price": 1300000, "average_mileage": 19000, "category": "sedan"},
        {"brand": "Honda", "model": "Civic", "year": 2022, "base_price": 1150000, "average_mileage": 34000, "category": "sedan"},
        {"brand": "Honda", "model": "Civic", "year": 2021, "base_price": 980000, "average_mileage": 48000, "category": "sedan"},
        {"brand": "Honda", "model": "Accord", "year": 2024, "base_price": 1850000, "average_mileage": 8000, "category": "sedan"},
        {"brand": "Honda", "model": "Accord", "year": 2023, "base_price": 1650000, "average_mileage": 22000, "category": "sedan"},
        {"brand": "Honda", "model": "CR-V", "year": 2024, "base_price": 2050000, "average_mileage": 7000, "category": "suv"},
        {"brand": "Honda", "model": "CR-V", "year": 2023, "base_price": 1850000, "average_mileage": 21000, "category": "suv"},
        {"brand": "Honda", "model": "HR-V", "year": 2024, "base_price": 1550000, "average_mileage": 5000, "category": "suv"},
        
        # Toyota
        {"brand": "Toyota", "model": "Corolla", "year": 2024, "base_price": 1350000, "average_mileage": 5000, "category": "sedan"},
        {"brand": "Toyota", "model": "Corolla", "year": 2023, "base_price": 1200000, "average_mileage": 18000, "category": "sedan"},
        {"brand": "Toyota", "model": "Corolla", "year": 2022, "base_price": 1050000, "average_mileage": 33000, "category": "sedan"},
        {"brand": "Toyota", "model": "Corolla", "year": 2021, "base_price": 900000, "average_mileage": 47000, "category": "sedan"},
        {"brand": "Toyota", "model": "Yaris", "year": 2024, "base_price": 950000, "average_mileage": 3000, "category": "hatchback"},
        {"brand": "Toyota", "model": "Yaris", "year": 2023, "base_price": 850000, "average_mileage": 16000, "category": "hatchback"},
        {"brand": "Toyota", "model": "Yaris", "year": 2022, "base_price": 750000, "average_mileage": 30000, "category": "hatchback"},
        {"brand": "Toyota", "model": "C-HR", "year": 2024, "base_price": 1650000, "average_mileage": 6000, "category": "suv"},
        {"brand": "Toyota", "model": "C-HR", "year": 2023, "base_price": 1480000, "average_mileage": 20000, "category": "suv"},
        {"brand": "Toyota", "model": "RAV4", "year": 2024, "base_price": 2250000, "average_mileage": 7000, "category": "suv"},
        {"brand": "Toyota", "model": "RAV4", "year": 2023, "base_price": 2000000, "average_mileage": 22000, "category": "suv"},
        
        # Additional models for variety
        {"brand": "Volkswagen", "model": "T-Roc", "year": 2024, "base_price": 1750000, "average_mileage": 5000, "category": "suv"},
        {"brand": "Renault", "model": "Kadjar", "year": 2023, "base_price": 1350000, "average_mileage": 23000, "category": "suv"},
        {"brand": "Honda", "model": "Jazz", "year": 2023, "base_price": 950000, "average_mileage": 17000, "category": "hatchback"},
        {"brand": "Toyota", "model": "Camry", "year": 2024, "base_price": 2100000, "average_mileage": 9000, "category": "sedan"},
        {"brand": "Volkswagen", "model": "Golf", "year": 2021, "base_price": 780000, "average_mileage": 52000, "category": "hatchback"},
        {"brand": "Renault", "model": "Megane", "year": 2021, "base_price": 720000, "average_mileage": 48000, "category": "sedan"},
        {"brand": "Honda", "model": "Civic", "year": 2020, "base_price": 850000, "average_mileage": 65000, "category": "sedan"},
        {"brand": "Toyota", "model": "Corolla", "year": 2020, "base_price": 780000, "average_mileage": 62000, "category": "sedan"},
    ]
    
    vehicles_to_insert = []
    for vehicle_data in mock_vehicles:
        vehicle_data["vehicle_id"] = f"veh_{uuid.uuid4().hex[:12]}"
        vehicle_data["created_at"] = datetime.now(timezone.utc)
        vehicles_to_insert.append(vehicle_data)
    
    await db.vehicles.insert_many(vehicles_to_insert)
    
    # Create price history for trending data
    for vehicle in vehicles_to_insert[:10]:  # Add history for first 10 vehicles
        price_history = []
        base_price = vehicle["base_price"]
        
        # Generate 12 months of price history
        for i in range(12):
            months_ago = 12 - i
            date = datetime.now(timezone.utc) - timedelta(days=months_ago * 30)
            # Simulate gradual price changes
            price_variation = base_price * (0.9 + (i * 0.01))  # Gradual increase
            price_history.append({
                "date": date,
                "price": round(price_variation, 2),
                "mileage": vehicle["average_mileage"] - (months_ago * 1000)
            })
        
        await db.price_trends.insert_one({
            "vehicle_id": vehicle["vehicle_id"],
            "brand": vehicle["brand"],
            "model": vehicle["model"],
            "year": vehicle["year"],
            "price_history": price_history,
            "updated_at": datetime.now(timezone.utc)
        })

# ==================== PRICING ALGORITHM ====================

def calculate_vehicle_value(base_price: float, year: int, mileage: int, condition: str, market_trend: float = 1.0) -> Dict:
    """
    Advanced vehicle valuation algorithm
    
    Factors:
    - Year-based depreciation (15-20% first year, 10-15% subsequent years)
    - Mileage impact (penalty for excess mileage)
    - Condition multiplier (excellent: 1.15, good: 1.0, fair: 0.85, poor: 0.70)
    - Market trend factor
    """
    current_year = 2025
    age = current_year - year
    
    # Year-based depreciation
    if age == 0:
        depreciation = 0
    elif age == 1:
        depreciation = 0.175  # 17.5% first year
    else:
        # 17.5% first year + 12.5% for each subsequent year
        depreciation = 0.175 + (age - 1) * 0.125
    
    # Cap depreciation at 85%
    depreciation = min(depreciation, 0.85)
    
    # Mileage impact (per 10,000 km over expected)
    expected_mileage = age * 15000  # 15k km/year average in Turkey
    excess_mileage = max(0, mileage - expected_mileage)
    mileage_penalty = (excess_mileage / 10000) * 0.02  # 2% per 10k excess
    mileage_penalty = min(mileage_penalty, 0.30)  # Cap at 30%
    
    # Condition multiplier
    condition_factors = {
        'excellent': 1.15,
        'good': 1.0,
        'fair': 0.85,
        'poor': 0.70
    }
    condition_factor = condition_factors.get(condition.lower(), 1.0)
    
    # Calculate final value
    depreciated_value = base_price * (1 - depreciation - mileage_penalty)
    final_value = depreciated_value * condition_factor * market_trend
    
    # Floor at 15% of original price
    final_value = max(final_value, base_price * 0.15)
    
    return {
        "estimated_value": round(final_value, 2),
        "depreciation_percentage": round(depreciation * 100, 2),
        "mileage_impact": round(mileage_penalty * 100, 2),
        "condition_factor": condition_factor,
        "market_trend": market_trend,
        "breakdown": {
            "base_price": base_price,
            "age_years": age,
            "expected_mileage": expected_mileage,
            "actual_mileage": mileage,
            "excess_mileage": excess_mileage,
            "depreciated_value": round(depreciated_value, 2),
            "after_condition": round(depreciated_value * condition_factor, 2),
            "final_value": round(final_value, 2)
        }
    }

# ==================== VEHICLE ENDPOINTS ====================

@api_router.get("/vehicles/search")
async def search_vehicles(
    brand: Optional[str] = None,
    model: Optional[str] = None,
    year_min: Optional[int] = None,
    year_max: Optional[int] = None,
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Search vehicles with filters"""
    query = {}
    
    if brand:
        query["brand"] = {"$regex": brand, "$options": "i"}
    if model:
        query["model"] = {"$regex": model, "$options": "i"}
    if year_min or year_max:
        query["year"] = {}
        if year_min:
            query["year"]["$gte"] = year_min
        if year_max:
            query["year"]["$lte"] = year_max
    if price_min or price_max:
        query["base_price"] = {}
        if price_min:
            query["base_price"]["$gte"] = price_min
        if price_max:
            query["base_price"]["$lte"] = price_max
    if category:
        query["category"] = category
    
    vehicles = await db.vehicles.find(query, {"_id": 0}).limit(50).to_list(50)
    return vehicles

@api_router.get("/vehicles/brands")
async def get_brands(current_user: User = Depends(get_current_user)):
    """Get unique vehicle brands"""
    brands = await db.vehicles.distinct("brand")
    return sorted(brands)

@api_router.get("/vehicles/models/{brand}")
async def get_models(brand: str, current_user: User = Depends(get_current_user)):
    """Get models for a specific brand"""
    models = await db.vehicles.distinct("model", {"brand": brand})
    return sorted(models)

@api_router.get("/vehicles/{vehicle_id}")
async def get_vehicle(vehicle_id: str, current_user: User = Depends(get_current_user)):
    """Get vehicle details"""
    vehicle = await db.vehicles.find_one({"vehicle_id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle

@api_router.post("/vehicles/calculate")
async def calculate_valuation(
    request: ValuationRequest,
    current_user: User = Depends(get_current_user)
):
    """Calculate vehicle valuation"""
    # Find similar vehicle in database for base price
    vehicle = await db.vehicles.find_one({
        "brand": {"$regex": f"^{request.brand}$", "$options": "i"},
        "model": {"$regex": f"^{request.model}$", "$options": "i"},
        "year": request.year
    }, {"_id": 0})
    
    if not vehicle:
        # Find closest match by brand and model
        vehicle = await db.vehicles.find_one({
            "brand": {"$regex": f"^{request.brand}$", "$options": "i"},
            "model": {"$regex": f"^{request.model}$", "$options": "i"}
        }, {"_id": 0})
        
        if not vehicle:
            raise HTTPException(status_code=404, detail="Vehicle not found in database")
    
    # Calculate valuation
    result = calculate_vehicle_value(
        vehicle["base_price"],
        request.year,
        request.mileage,
        request.condition
    )
    
    return result

@api_router.get("/vehicles/trends/{vehicle_id}")
async def get_price_trends(vehicle_id: str, current_user: User = Depends(get_current_user)):
    """Get price trends for a vehicle"""
    trends = await db.price_trends.find_one({"vehicle_id": vehicle_id}, {"_id": 0})
    if not trends:
        raise HTTPException(status_code=404, detail="Price trends not found")
    return trends

# ==================== SAVED VEHICLES ====================

@api_router.post("/vehicles/save")
async def save_vehicle(
    request: SaveVehicleRequest,
    current_user: User = Depends(get_current_user)
):
    """Save a vehicle valuation"""
    saved_id = f"saved_{uuid.uuid4().hex[:12]}"
    
    saved_vehicle = {
        "saved_id": saved_id,
        "user_id": current_user.user_id,
        "vehicle_id": request.vehicle_id,
        "estimated_value": request.estimated_value,
        "valuation_data": request.valuation_data,
        "saved_at": datetime.now(timezone.utc)
    }
    
    await db.saved_vehicles.insert_one(saved_vehicle)
    return {"message": "Vehicle saved successfully", "saved_id": saved_id}

@api_router.get("/vehicles/saved")
async def get_saved_vehicles(current_user: User = Depends(get_current_user)):
    """Get user's saved vehicles"""
    saved = await db.saved_vehicles.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("saved_at", -1).to_list(100)
    
    # Enrich with vehicle details
    for item in saved:
        vehicle = await db.vehicles.find_one(
            {"vehicle_id": item["vehicle_id"]},
            {"_id": 0}
        )
        if vehicle:
            item["vehicle_details"] = vehicle
    
    return saved

@api_router.delete("/vehicles/saved/{saved_id}")
async def delete_saved_vehicle(saved_id: str, current_user: User = Depends(get_current_user)):
    """Delete a saved vehicle"""
    result = await db.saved_vehicles.delete_one({
        "saved_id": saved_id,
        "user_id": current_user.user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Saved vehicle not found")
    
    return {"message": "Saved vehicle deleted successfully"}

# ==================== OCR ENDPOINTS ====================

@api_router.post("/ocr/scan")
async def scan_document(
    image: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Scan vehicle document using OCR"""
    try:
        # Read image
        contents = await image.read()
        img = Image.open(BytesIO(contents))
        
        # Perform OCR
        detected_text = pytesseract.image_to_string(img)
        
        # Extract VIN (17 characters, alphanumeric)
        vin_pattern = r'\b[A-HJ-NPR-Z0-9]{17}\b'
        vin_match = re.search(vin_pattern, detected_text.upper())
        vin = vin_match.group(0) if vin_match else None
        
        # Extract Turkish license plate (format: 34 ABC 1234)
        plate_pattern = r'\b\d{2}\s*[A-Z]{1,3}\s*\d{2,4}\b'
        plate_match = re.search(plate_pattern, detected_text.upper())
        license_plate = plate_match.group(0) if plate_match else None
        
        # Try to extract year (4 digits)
        year_pattern = r'\b(19|20)\d{2}\b'
        year_match = re.search(year_pattern, detected_text)
        year = int(year_match.group(0)) if year_match else None
        
        return {
            "detected_text": detected_text,
            "vin": vin,
            "license_plate": license_plate,
            "extracted_data": {
                "year": year,
                "has_vin": vin is not None,
                "has_plate": license_plate is not None
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")

@api_router.post("/ocr/scan-base64")
async def scan_document_base64(
    request: OCRRequest,
    current_user: User = Depends(get_current_user)
):
    """Scan vehicle document from base64 image"""
    try:
        # Decode base64
        image_base64 = request.image_base64
        if ',' in image_base64:
            image_base64 = image_base64.split(',')[1]
        
        image_data = base64.b64decode(image_base64)
        img = Image.open(BytesIO(image_data))
        
        # Perform OCR
        detected_text = pytesseract.image_to_string(img)
        
        # Extract VIN
        vin_pattern = r'\b[A-HJ-NPR-Z0-9]{17}\b'
        vin_match = re.search(vin_pattern, detected_text.upper())
        vin = vin_match.group(0) if vin_match else None
        
        # Extract Turkish license plate
        plate_pattern = r'\b\d{2}\s*[A-Z]{1,3}\s*\d{2,4}\b'
        plate_match = re.search(plate_pattern, detected_text.upper())
        license_plate = plate_match.group(0) if plate_match else None
        
        # Extract year
        year_pattern = r'\b(19|20)\d{2}\b'
        year_match = re.search(year_pattern, detected_text)
        year = int(year_match.group(0)) if year_match else None
        
        return {
            "detected_text": detected_text,
            "vin": vin,
            "license_plate": license_plate,
            "extracted_data": {
                "year": year,
                "has_vin": vin is not None,
                "has_plate": license_plate is not None
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")

# ==================== STARTUP ====================

@app.on_event("startup")
async def startup_event():
    """Initialize data on startup"""
    await initialize_mock_data()
    logger.info("Mock data initialized")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
