import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width } = Dimensions.get('window');

interface Vehicle {
  vehicle_id: string;
  brand: string;
  model: string;
  year: number;
  base_price: number;
  average_mileage: number;
  category: string;
}

export default function HomeScreen() {
  const { sessionToken } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [vehiclesRes, brandsRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/vehicles/search`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        }),
        axios.get(`${BACKEND_URL}/api/vehicles/brands`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        }),
      ]);
      setVehicles(vehiclesRes.data);
      setBrands(brandsRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchVehicles = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (selectedBrand) params.brand = selectedBrand;
      if (searchQuery) params.model = searchQuery;

      const response = await axios.get(`${BACKEND_URL}/api/vehicles/search`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
        params,
      });
      setVehicles(response.data);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderVehicleCard = ({ item }: { item: Vehicle }) => (
    <View style={styles.vehicleCard}>
      <View style={styles.vehicleHeader}>
        <View style={styles.vehicleIcon}>
          <Ionicons name="car-sport" size={24} color="#4F46E5" />
        </View>
        <View style={styles.vehicleInfo}>
          <Text style={styles.vehicleBrand}>{item.brand}</Text>
          <Text style={styles.vehicleModel}>{item.model}</Text>
        </View>
        <View style={styles.vehicleYear}>
          <Text style={styles.yearText}>{item.year}</Text>
        </View>
      </View>
      <View style={styles.vehicleDetails}>
        <View style={styles.detailItem}>
          <Ionicons name="speedometer" size={16} color="#888" />
          <Text style={styles.detailText}>{item.average_mileage.toLocaleString('tr-TR')} km</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="pricetag" size={16} color="#888" />
          <Text style={styles.detailText}>
            {item.base_price.toLocaleString('tr-TR')} ₺
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="grid" size={16} color="#888" />
          <Text style={styles.detailText}>{item.category}</Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>CARLYTICS</Text>
        <Text style={styles.headerSubtitle}>Araç Ara</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#888" />
          <TextInput
            style={styles.searchInput}
            placeholder="Model ara..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={searchVehicles}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#888" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Brand Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.brandFilter}
        contentContainerStyle={styles.brandFilterContent}
      >
        <TouchableOpacity
          style={[
            styles.brandChip,
            !selectedBrand && styles.brandChipActive,
          ]}
          onPress={() => {
            setSelectedBrand(null);
            searchVehicles();
          }}
        >
          <Text
            style={[
              styles.brandChipText,
              !selectedBrand && styles.brandChipTextActive,
            ]}
          >
            Tümü
          </Text>
        </TouchableOpacity>
        {brands.map((brand) => (
          <TouchableOpacity
            key={brand}
            style={[
              styles.brandChip,
              selectedBrand === brand && styles.brandChipActive,
            ]}
            onPress={() => {
              setSelectedBrand(brand);
              setTimeout(searchVehicles, 100);
            }}
          >
            <Text
              style={[
                styles.brandChipText,
                selectedBrand === brand && styles.brandChipTextActive,
              ]}
            >
              {brand}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Results */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>
          {vehicles.length} araç bulundu
        </Text>
      </View>

      {/* Vehicle List */}
      <FlatList
        data={vehicles}
        renderItem={renderVehicleCard}
        keyExtractor={(item) => item.vehicle_id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0c0c0c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    padding: 24,
    paddingTop: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#888',
  },
  searchContainer: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#fff',
  },
  brandFilter: {
    maxHeight: 50,
    marginBottom: 16,
  },
  brandFilterContent: {
    paddingHorizontal: 24,
    gap: 8,
  },
  brandChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    marginRight: 8,
  },
  brandChipActive: {
    backgroundColor: '#4F46E5',
  },
  brandChipText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  brandChipTextActive: {
    color: '#fff',
  },
  resultsHeader: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  resultsCount: {
    fontSize: 14,
    color: '#888',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  vehicleCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  vehicleIcon: {
    width: 48,
    height: 48,
    backgroundColor: '#0c0c0c',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleInfo: {
    flex: 1,
    marginLeft: 12,
  },
  vehicleBrand: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  vehicleModel: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  vehicleYear: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  yearText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  vehicleDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: '#888',
  },
});