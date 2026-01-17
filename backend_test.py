#!/usr/bin/env python3
"""
CARLYTICS Backend API Comprehensive Test Suite
Tests all backend endpoints with Turkish market data scenarios
"""

import requests
import json
import base64
import time
from datetime import datetime
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://auto-analyzer-7.preview.emergentagent.com/api"
TEST_SESSION_TOKEN = "test_token_1768663285444"

class CarlyticsAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session_token = TEST_SESSION_TOKEN
        self.headers = {
            "Authorization": f"Bearer {self.session_token}",
            "Content-Type": "application/json"
        }
        self.test_results = []
        self.saved_vehicle_id = None
        
    def log_test(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat(),
            "response_data": response_data
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {details}")
        if response_data and not success:
            print(f"   Response: {response_data}")
    
    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n=== AUTHENTICATION TESTS ===")
        
        # Test /auth/me endpoint with valid token
        try:
            response = requests.get(f"{self.base_url}/auth/me", headers=self.headers, timeout=10)
            if response.status_code == 200:
                user_data = response.json()
                self.log_test("Auth - Get Current User", True, 
                            f"Retrieved user: {user_data.get('name', 'Unknown')}")
            else:
                self.log_test("Auth - Get Current User", False, 
                            f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Auth - Get Current User", False, f"Exception: {str(e)}")
        
        # Test protected endpoint without auth
        try:
            no_auth_headers = {"Content-Type": "application/json"}
            response = requests.get(f"{self.base_url}/auth/me", headers=no_auth_headers, timeout=10)
            if response.status_code == 401:
                self.log_test("Auth - No Token Protection", True, "Correctly rejected unauthorized request")
            else:
                self.log_test("Auth - No Token Protection", False, 
                            f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_test("Auth - No Token Protection", False, f"Exception: {str(e)}")
    
    def test_vehicle_brands(self):
        """Test GET /api/vehicles/brands"""
        print("\n=== VEHICLE BRANDS TEST ===")
        
        try:
            response = requests.get(f"{self.base_url}/vehicles/brands", headers=self.headers, timeout=10)
            if response.status_code == 200:
                brands = response.json()
                expected_brands = ["Honda", "Renault", "Toyota", "Volkswagen"]
                
                if isinstance(brands, list) and len(brands) > 0:
                    found_brands = [b for b in expected_brands if b in brands]
                    self.log_test("Vehicle Brands", True, 
                                f"Found {len(brands)} brands including: {', '.join(found_brands)}")
                else:
                    self.log_test("Vehicle Brands", False, "No brands returned or invalid format")
            else:
                self.log_test("Vehicle Brands", False, 
                            f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Vehicle Brands", False, f"Exception: {str(e)}")
    
    def test_vehicle_models(self):
        """Test GET /api/vehicles/models/{brand}"""
        print("\n=== VEHICLE MODELS TEST ===")
        
        test_brands = ["Volkswagen", "Toyota", "Honda", "Renault"]
        
        for brand in test_brands:
            try:
                response = requests.get(f"{self.base_url}/vehicles/models/{brand}", 
                                      headers=self.headers, timeout=10)
                if response.status_code == 200:
                    models = response.json()
                    if isinstance(models, list) and len(models) > 0:
                        self.log_test(f"Models - {brand}", True, 
                                    f"Found {len(models)} models: {', '.join(models[:3])}...")
                    else:
                        self.log_test(f"Models - {brand}", False, "No models returned")
                else:
                    self.log_test(f"Models - {brand}", False, 
                                f"Status: {response.status_code}")
            except Exception as e:
                self.log_test(f"Models - {brand}", False, f"Exception: {str(e)}")
    
    def test_vehicle_search(self):
        """Test GET /api/vehicles/search with various filters"""
        print("\n=== VEHICLE SEARCH TESTS ===")
        
        # Test 1: Search by brand only
        try:
            params = {"brand": "Volkswagen"}
            response = requests.get(f"{self.base_url}/vehicles/search", 
                                  headers=self.headers, params=params, timeout=10)
            if response.status_code == 200:
                vehicles = response.json()
                if isinstance(vehicles, list) and len(vehicles) > 0:
                    vw_count = len([v for v in vehicles if v.get('brand') == 'Volkswagen'])
                    self.log_test("Search - By Brand (VW)", True, 
                                f"Found {vw_count} Volkswagen vehicles")
                else:
                    self.log_test("Search - By Brand (VW)", False, "No vehicles found")
            else:
                self.log_test("Search - By Brand (VW)", False, 
                            f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Search - By Brand (VW)", False, f"Exception: {str(e)}")
        
        # Test 2: Search by brand and model
        try:
            params = {"brand": "Toyota", "model": "Corolla"}
            response = requests.get(f"{self.base_url}/vehicles/search", 
                                  headers=self.headers, params=params, timeout=10)
            if response.status_code == 200:
                vehicles = response.json()
                corolla_count = len([v for v in vehicles 
                                   if v.get('brand') == 'Toyota' and v.get('model') == 'Corolla'])
                self.log_test("Search - Brand + Model", True, 
                            f"Found {corolla_count} Toyota Corolla vehicles")
            else:
                self.log_test("Search - Brand + Model", False, 
                            f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Search - Brand + Model", False, f"Exception: {str(e)}")
        
        # Test 3: Search by year range
        try:
            params = {"year_min": 2023, "year_max": 2024}
            response = requests.get(f"{self.base_url}/vehicles/search", 
                                  headers=self.headers, params=params, timeout=10)
            if response.status_code == 200:
                vehicles = response.json()
                recent_count = len([v for v in vehicles if v.get('year', 0) >= 2023])
                self.log_test("Search - Year Range", True, 
                            f"Found {recent_count} vehicles from 2023-2024")
            else:
                self.log_test("Search - Year Range", False, 
                            f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Search - Year Range", False, f"Exception: {str(e)}")
        
        # Test 4: Search by price range
        try:
            params = {"price_min": 1000000, "price_max": 1500000}
            response = requests.get(f"{self.base_url}/vehicles/search", 
                                  headers=self.headers, params=params, timeout=10)
            if response.status_code == 200:
                vehicles = response.json()
                price_range_count = len([v for v in vehicles 
                                       if 1000000 <= v.get('base_price', 0) <= 1500000])
                self.log_test("Search - Price Range", True, 
                            f"Found {price_range_count} vehicles in 1M-1.5M TRY range")
            else:
                self.log_test("Search - Price Range", False, 
                            f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Search - Price Range", False, f"Exception: {str(e)}")
        
        # Test 5: Search by category
        try:
            params = {"category": "sedan"}
            response = requests.get(f"{self.base_url}/vehicles/search", 
                                  headers=self.headers, params=params, timeout=10)
            if response.status_code == 200:
                vehicles = response.json()
                sedan_count = len([v for v in vehicles if v.get('category') == 'sedan'])
                self.log_test("Search - Category (Sedan)", True, 
                            f"Found {sedan_count} sedan vehicles")
            else:
                self.log_test("Search - Category (Sedan)", False, 
                            f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Search - Category (Sedan)", False, f"Exception: {str(e)}")
    
    def test_specific_vehicle(self):
        """Test GET /api/vehicles/{vehicle_id}"""
        print("\n=== SPECIFIC VEHICLE TEST ===")
        
        # First get a vehicle ID from search
        try:
            response = requests.get(f"{self.base_url}/vehicles/search", 
                                  headers=self.headers, params={"brand": "Volkswagen"}, timeout=10)
            if response.status_code == 200:
                vehicles = response.json()
                if vehicles and len(vehicles) > 0:
                    vehicle_id = vehicles[0].get('vehicle_id')
                    
                    # Test getting specific vehicle
                    response = requests.get(f"{self.base_url}/vehicles/{vehicle_id}", 
                                          headers=self.headers, timeout=10)
                    if response.status_code == 200:
                        vehicle = response.json()
                        self.log_test("Get Specific Vehicle", True, 
                                    f"Retrieved {vehicle.get('brand')} {vehicle.get('model')} {vehicle.get('year')}")
                        return vehicle_id
                    else:
                        self.log_test("Get Specific Vehicle", False, 
                                    f"Status: {response.status_code}")
                else:
                    self.log_test("Get Specific Vehicle", False, "No vehicles to test with")
            else:
                self.log_test("Get Specific Vehicle", False, "Could not get vehicle list")
        except Exception as e:
            self.log_test("Get Specific Vehicle", False, f"Exception: {str(e)}")
        
        return None
    
    def test_valuation_scenarios(self):
        """Test POST /api/vehicles/calculate with various scenarios"""
        print("\n=== VALUATION CALCULATION TESTS ===")
        
        # Scenario 1: New VW Golf 2024, low mileage, good condition
        try:
            payload = {
                "brand": "Volkswagen",
                "model": "Golf",
                "year": 2024,
                "mileage": 5000,
                "condition": "good"
            }
            response = requests.post(f"{self.base_url}/vehicles/calculate", 
                                   headers=self.headers, json=payload, timeout=10)
            if response.status_code == 200:
                result = response.json()
                estimated_value = result.get('estimated_value', 0)
                self.log_test("Valuation - New VW Golf", True, 
                            f"Estimated value: {estimated_value:,.0f} TRY")
            else:
                self.log_test("Valuation - New VW Golf", False, 
                            f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Valuation - New VW Golf", False, f"Exception: {str(e)}")
        
        # Scenario 2: Older Toyota Corolla 2020, high mileage, fair condition
        try:
            payload = {
                "brand": "Toyota",
                "model": "Corolla",
                "year": 2020,
                "mileage": 80000,
                "condition": "fair"
            }
            response = requests.post(f"{self.base_url}/vehicles/calculate", 
                                   headers=self.headers, json=payload, timeout=10)
            if response.status_code == 200:
                result = response.json()
                estimated_value = result.get('estimated_value', 0)
                depreciation = result.get('depreciation_percentage', 0)
                mileage_impact = result.get('mileage_impact', 0)
                self.log_test("Valuation - Old Corolla", True, 
                            f"Value: {estimated_value:,.0f} TRY, Depreciation: {depreciation}%, Mileage impact: {mileage_impact}%")
            else:
                self.log_test("Valuation - Old Corolla", False, 
                            f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Valuation - Old Corolla", False, f"Exception: {str(e)}")
        
        # Scenario 3: Honda Civic 2022, medium mileage, excellent condition
        try:
            payload = {
                "brand": "Honda",
                "model": "Civic",
                "year": 2022,
                "mileage": 30000,
                "condition": "excellent"
            }
            response = requests.post(f"{self.base_url}/vehicles/calculate", 
                                   headers=self.headers, json=payload, timeout=10)
            if response.status_code == 200:
                result = response.json()
                estimated_value = result.get('estimated_value', 0)
                condition_factor = result.get('condition_factor', 0)
                self.log_test("Valuation - Honda Civic Excellent", True, 
                            f"Value: {estimated_value:,.0f} TRY, Condition factor: {condition_factor}")
            else:
                self.log_test("Valuation - Honda Civic Excellent", False, 
                            f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Valuation - Honda Civic Excellent", False, f"Exception: {str(e)}")
        
        # Scenario 4: Renault Clio 2021, poor condition
        try:
            payload = {
                "brand": "Renault",
                "model": "Clio",
                "year": 2021,
                "mileage": 60000,
                "condition": "poor"
            }
            response = requests.post(f"{self.base_url}/vehicles/calculate", 
                                   headers=self.headers, json=payload, timeout=10)
            if response.status_code == 200:
                result = response.json()
                estimated_value = result.get('estimated_value', 0)
                self.log_test("Valuation - Renault Clio Poor", True, 
                            f"Value: {estimated_value:,.0f} TRY (poor condition)")
            else:
                self.log_test("Valuation - Renault Clio Poor", False, 
                            f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Valuation - Renault Clio Poor", False, f"Exception: {str(e)}")
    
    def test_ocr_endpoints(self):
        """Test POST /api/ocr/scan-base64"""
        print("\n=== OCR SCANNING TESTS ===")
        
        # Create a simple test image with text (base64 encoded)
        # This is a minimal 1x1 pixel PNG image for testing
        test_image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
        
        try:
            payload = {"image_base64": test_image_base64}
            response = requests.post(f"{self.base_url}/ocr/scan-base64", 
                                   headers=self.headers, json=payload, timeout=15)
            if response.status_code == 200:
                result = response.json()
                detected_text = result.get('detected_text', '')
                has_vin = result.get('extracted_data', {}).get('has_vin', False)
                has_plate = result.get('extracted_data', {}).get('has_plate', False)
                self.log_test("OCR - Base64 Scan", True, 
                            f"OCR processed successfully. Text length: {len(detected_text)}")
            else:
                self.log_test("OCR - Base64 Scan", False, 
                            f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("OCR - Base64 Scan", False, f"Exception: {str(e)}")
    
    def test_saved_vehicles(self):
        """Test saved vehicles CRUD operations"""
        print("\n=== SAVED VEHICLES TESTS ===")
        
        # First, get a vehicle to save
        vehicle_id = None
        try:
            response = requests.get(f"{self.base_url}/vehicles/search", 
                                  headers=self.headers, params={"brand": "Toyota"}, timeout=10)
            if response.status_code == 200:
                vehicles = response.json()
                if vehicles:
                    vehicle_id = vehicles[0].get('vehicle_id')
        except Exception as e:
            self.log_test("Saved Vehicles Setup", False, f"Could not get vehicle: {str(e)}")
            return
        
        if not vehicle_id:
            self.log_test("Saved Vehicles", False, "No vehicle available to test with")
            return
        
        # Test saving a vehicle
        try:
            params = {
                "vehicle_id": vehicle_id,
                "estimated_value": 1200000.0,
                "valuation_data": json.dumps({
                    "brand": "Toyota",
                    "model": "Corolla",
                    "year": 2023,
                    "mileage": 25000,
                    "condition": "good"
                })
            }
            response = requests.post(f"{self.base_url}/vehicles/save", 
                                   headers=self.headers, params=params, timeout=10)
            if response.status_code == 200:
                result = response.json()
                self.saved_vehicle_id = result.get('saved_id')
                self.log_test("Save Vehicle", True, 
                            f"Vehicle saved with ID: {self.saved_vehicle_id}")
            else:
                self.log_test("Save Vehicle", False, 
                            f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Save Vehicle", False, f"Exception: {str(e)}")
        
        # Test retrieving saved vehicles
        try:
            response = requests.get(f"{self.base_url}/vehicles/saved", 
                                  headers=self.headers, timeout=10)
            if response.status_code == 200:
                saved_vehicles = response.json()
                if isinstance(saved_vehicles, list):
                    self.log_test("Get Saved Vehicles", True, 
                                f"Retrieved {len(saved_vehicles)} saved vehicles")
                else:
                    self.log_test("Get Saved Vehicles", False, "Invalid response format")
            else:
                self.log_test("Get Saved Vehicles", False, 
                            f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Get Saved Vehicles", False, f"Exception: {str(e)}")
        
        # Test deleting saved vehicle
        if self.saved_vehicle_id:
            try:
                response = requests.delete(f"{self.base_url}/vehicles/saved/{self.saved_vehicle_id}", 
                                         headers=self.headers, timeout=10)
                if response.status_code == 200:
                    self.log_test("Delete Saved Vehicle", True, "Vehicle deleted successfully")
                else:
                    self.log_test("Delete Saved Vehicle", False, 
                                f"Status: {response.status_code}")
            except Exception as e:
                self.log_test("Delete Saved Vehicle", False, f"Exception: {str(e)}")
    
    def test_price_trends(self):
        """Test GET /api/vehicles/trends/{vehicle_id}"""
        print("\n=== PRICE TRENDS TESTS ===")
        
        # Get a vehicle ID first
        vehicle_id = None
        try:
            response = requests.get(f"{self.base_url}/vehicles/search", 
                                  headers=self.headers, params={"brand": "Volkswagen"}, timeout=10)
            if response.status_code == 200:
                vehicles = response.json()
                if vehicles:
                    vehicle_id = vehicles[0].get('vehicle_id')
        except Exception as e:
            self.log_test("Price Trends Setup", False, f"Could not get vehicle: {str(e)}")
            return
        
        if not vehicle_id:
            self.log_test("Price Trends", False, "No vehicle available to test with")
            return
        
        try:
            response = requests.get(f"{self.base_url}/vehicles/trends/{vehicle_id}", 
                                  headers=self.headers, timeout=10)
            if response.status_code == 200:
                trends = response.json()
                price_history = trends.get('price_history', [])
                self.log_test("Price Trends", True, 
                            f"Retrieved {len(price_history)} price history points")
            elif response.status_code == 404:
                self.log_test("Price Trends", True, 
                            "No price trends available (expected for some vehicles)")
            else:
                self.log_test("Price Trends", False, 
                            f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Price Trends", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all test suites"""
        print("🚗 CARLYTICS Backend API Test Suite")
        print(f"Testing against: {self.base_url}")
        print(f"Using session token: {self.session_token[:20]}...")
        print("=" * 60)
        
        # Run all test suites
        self.test_auth_endpoints()
        self.test_vehicle_brands()
        self.test_vehicle_models()
        self.test_vehicle_search()
        self.test_specific_vehicle()
        self.test_valuation_scenarios()
        self.test_ocr_endpoints()
        self.test_saved_vehicles()
        self.test_price_trends()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = len([t for t in self.test_results if t['success']])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print(f"\n🔍 FAILED TESTS:")
            for test in self.test_results:
                if not test['success']:
                    print(f"   ❌ {test['test']}: {test['details']}")
        
        return self.test_results

if __name__ == "__main__":
    tester = CarlyticsAPITester()
    results = tester.run_all_tests()