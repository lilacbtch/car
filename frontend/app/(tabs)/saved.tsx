import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface SavedVehicle {
  saved_id: string;
  vehicle_id: string;
  estimated_value: number;
  valuation_data: any;
  saved_at: string;
  vehicle_details?: {
    brand: string;
    model: string;
    year: number;
    category: string;
  };
}

export default function SavedScreen() {
  const { sessionToken } = useAuth();
  const [savedVehicles, setSavedVehicles] = useState<SavedVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSavedVehicles();
  }, []);

  const loadSavedVehicles = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${BACKEND_URL}/api/vehicles/saved`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      setSavedVehicles(response.data);
    } catch (error) {
      console.error('Failed to load saved vehicles:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const deleteSaved = async (savedId: string) => {
    Alert.alert(
      'Araç Sil',
      'Bu araç değerlemesini silmek istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(
                `${BACKEND_URL}/api/vehicles/saved/${savedId}`,
                {
                  headers: { Authorization: `Bearer ${sessionToken}` },
                }
              );
              setSavedVehicles((prev) =>
                prev.filter((v) => v.saved_id !== savedId)
              );
            } catch (error) {
              console.error('Failed to delete saved vehicle:', error);
              Alert.alert('Hata', 'Silme işlemi başarısız oldu');
            }
          },
        },
      ]
    );
  };

  const renderSavedVehicle = ({ item }: { item: SavedVehicle }) => (
    <View style={styles.vehicleCard}>
      <View style={styles.vehicleHeader}>
        <View style={styles.vehicleIcon}>
          <Ionicons name="bookmark" size={24} color="#4F46E5" />
        </View>
        <View style={styles.vehicleInfo}>
          {item.vehicle_details && (
            <>
              <Text style={styles.vehicleBrand}>
                {item.vehicle_details.brand}
              </Text>
              <Text style={styles.vehicleModel}>
                {item.vehicle_details.model} {item.vehicle_details.year}
              </Text>
            </>
          )}
        </View>
        <TouchableOpacity onPress={() => deleteSaved(item.saved_id)}>
          <Ionicons name="trash-outline" size={24} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <View style={styles.valuationContainer}>
        <View style={styles.valuationRow}>
          <Text style={styles.valuationLabel}>Tahmini Değer</Text>
          <Text style={styles.valuationAmount}>
            {item.estimated_value.toLocaleString('tr-TR')} ₺
          </Text>
        </View>

        {item.valuation_data && (
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Ionicons name="trending-down" size={14} color="#888" />
              <Text style={styles.detailText}>
                Değer Kaybı: %
                {item.valuation_data.depreciation_percentage?.toFixed(1) || 0}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="shield-checkmark" size={14} color="#888" />
              <Text style={styles.detailText}>
                Çarpan: x{item.valuation_data.condition_factor?.toFixed(2) || 1}
              </Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.dateContainer}>
        <Ionicons name="time-outline" size={14} color="#666" />
        <Text style={styles.dateText}>
          {new Date(item.saved_at).toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </Text>
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
        <Text style={styles.headerTitle}>Kaydedilenler</Text>
        <Text style={styles.headerSubtitle}>
          {savedVehicles.length} araç değerlemesi kaydedildi
        </Text>
      </View>

      {/* List */}
      {savedVehicles.length > 0 ? (
        <FlatList
          data={savedVehicles}
          renderItem={renderSavedVehicle}
          keyExtractor={(item) => item.saved_id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadSavedVehicles();
          }}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="bookmark-outline" size={64} color="#333" />
          <Text style={styles.emptyTitle}>Henüz Kaydedilmiş Araç Yok</Text>
          <Text style={styles.emptyText}>
            Değerleme yaptıktan sonra araçları kaydedin
          </Text>
        </View>
      )}
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
    marginBottom: 16,
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
  valuationContainer: {
    backgroundColor: '#0c0c0c',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  valuationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  valuationLabel: {
    fontSize: 14,
    color: '#888',
  },
  valuationAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  detailsGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    color: '#888',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 12,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 48,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 24,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});