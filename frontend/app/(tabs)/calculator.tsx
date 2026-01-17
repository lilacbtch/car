import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { Picker } from '@react-native-picker/picker';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface ValuationResult {
  estimated_value: number;
  depreciation_percentage: number;
  mileage_impact: number;
  condition_factor: number;
  market_trend: number;
  breakdown: any;
}

export default function CalculatorScreen() {
  const { sessionToken } = useAuth();
  const [brands, setBrands] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);

  // Form state
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [year, setYear] = useState('');
  const [mileage, setMileage] = useState('');
  const [condition, setCondition] = useState('good');

  // Result state
  const [result, setResult] = useState<ValuationResult | null>(null);

  useEffect(() => {
    loadBrands();
  }, []);

  useEffect(() => {
    if (selectedBrand) {
      loadModels(selectedBrand);
    }
  }, [selectedBrand]);

  const loadBrands = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${BACKEND_URL}/api/vehicles/brands`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      setBrands(response.data);
    } catch (error) {
      console.error('Failed to load brands:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadModels = async (brand: string) => {
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/vehicles/models/${brand}`,
        {
          headers: { Authorization: `Bearer ${sessionToken}` },
        }
      );
      setModels(response.data);
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  };

  const calculateValue = async () => {
    if (!selectedBrand || !selectedModel || !year || !mileage) {
      alert('Lütfen tüm alanları doldurun');
      return;
    }

    try {
      setCalculating(true);
      const response = await axios.post(
        `${BACKEND_URL}/api/vehicles/calculate`,
        {
          brand: selectedBrand,
          model: selectedModel,
          year: parseInt(year),
          mileage: parseInt(mileage),
          condition: condition,
        },
        {
          headers: { Authorization: `Bearer ${sessionToken}` },
        }
      );
      setResult(response.data);
    } catch (error: any) {
      console.error('Calculation failed:', error);
      alert(
        error.response?.data?.detail ||
          'Değerleme hesaplanamadı. Lütfen bilgileri kontrol edin.'
      );
    } finally {
      setCalculating(false);
    }
  };

  const resetForm = () => {
    setSelectedBrand('');
    setSelectedModel('');
    setYear('');
    setMileage('');
    setCondition('good');
    setResult(null);
    setModels([]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Araç Değerle</Text>
            <Text style={styles.headerSubtitle}>
              Araç bilgilerini girerek anlık değerleme yapın
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Brand Picker */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Marka</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedBrand}
                  onValueChange={(value) => setSelectedBrand(value)}
                  style={styles.picker}
                  dropdownIconColor="#888"
                >
                  <Picker.Item label="Marka seçin..." value="" />
                  {brands.map((brand) => (
                    <Picker.Item key={brand} label={brand} value={brand} />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Model Picker */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Model</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedModel}
                  onValueChange={(value) => setSelectedModel(value)}
                  style={styles.picker}
                  enabled={models.length > 0}
                  dropdownIconColor="#888"
                >
                  <Picker.Item label="Model seçin..." value="" />
                  {models.map((model) => (
                    <Picker.Item key={model} label={model} value={model} />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Year Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Yıl</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="calendar" size={20} color="#888" />
                <TextInput
                  style={styles.input}
                  placeholder="Örn: 2020"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                  value={year}
                  onChangeText={setYear}
                  maxLength={4}
                />
              </View>
            </View>

            {/* Mileage Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Kilometre</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="speedometer" size={20} color="#888" />
                <TextInput
                  style={styles.input}
                  placeholder="Örn: 50000"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                  value={mileage}
                  onChangeText={setMileage}
                />
              </View>
            </View>

            {/* Condition Picker */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Durum</Text>
              <View style={styles.conditionButtons}>
                {[
                  { value: 'excellent', label: 'Mükemmel', icon: 'star' },
                  { value: 'good', label: 'İyi', icon: 'checkmark-circle' },
                  { value: 'fair', label: 'Orta', icon: 'remove-circle' },
                  { value: 'poor', label: 'Kötü', icon: 'close-circle' },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.conditionButton,
                      condition === opt.value && styles.conditionButtonActive,
                    ]}
                    onPress={() => setCondition(opt.value)}
                  >
                    <Ionicons
                      name={opt.icon as any}
                      size={20}
                      color={condition === opt.value ? '#fff' : '#888'}
                    />
                    <Text
                      style={[
                        styles.conditionButtonText,
                        condition === opt.value &&
                          styles.conditionButtonTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Calculate Button */}
            <TouchableOpacity
              style={styles.calculateButton}
              onPress={calculateValue}
              disabled={calculating}
            >
              {calculating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="calculator" size={24} color="#fff" />
                  <Text style={styles.calculateButtonText}>Değerle</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Result */}
          {result && (
            <View style={styles.resultContainer}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultTitle}>Tahmini Değer</Text>
                <TouchableOpacity onPress={resetForm}>
                  <Ionicons name="refresh" size={24} color="#888" />
                </TouchableOpacity>
              </View>

              <View style={styles.mainValue}>
                <Text style={styles.valueAmount}>
                  {result.estimated_value.toLocaleString('tr-TR')}
                </Text>
                <Text style={styles.valueCurrency}>₺</Text>
              </View>

              <View style={styles.breakdown}>
                <View style={styles.breakdownItem}>
                  <View style={styles.breakdownLeft}>
                    <Ionicons name="trending-down" size={16} color="#EF4444" />
                    <Text style={styles.breakdownLabel}>Değer Kaybı</Text>
                  </View>
                  <Text style={styles.breakdownValue}>
                    %{result.depreciation_percentage.toFixed(1)}
                  </Text>
                </View>

                <View style={styles.breakdownItem}>
                  <View style={styles.breakdownLeft}>
                    <Ionicons name="speedometer" size={16} color="#F59E0B" />
                    <Text style={styles.breakdownLabel}>Kilometre Etkisi</Text>
                  </View>
                  <Text style={styles.breakdownValue}>
                    %{result.mileage_impact.toFixed(1)}
                  </Text>
                </View>

                <View style={styles.breakdownItem}>
                  <View style={styles.breakdownLeft}>
                    <Ionicons name="shield-checkmark" size={16} color="#10B981" />
                    <Text style={styles.breakdownLabel}>Durum Çarpanı</Text>
                  </View>
                  <Text style={styles.breakdownValue}>
                    x{result.condition_factor.toFixed(2)}
                  </Text>
                </View>
              </View>

              <Text style={styles.disclaimer}>
                * Bu değer tahminidir ve piyasa koşullarına göre değişebilir
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
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
    lineHeight: 20,
  },
  form: {
    paddingHorizontal: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  picker: {
    color: '#fff',
    height: 48,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#fff',
  },
  conditionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  conditionButton: {
    flex: 1,
    minWidth: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  conditionButtonActive: {
    backgroundColor: '#4F46E5',
  },
  conditionButtonText: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  conditionButtonTextActive: {
    color: '#fff',
  },
  calculateButton: {
    flexDirection: 'row',
    backgroundColor: '#4F46E5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 12,
  },
  calculateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultContainer: {
    margin: 24,
    padding: 24,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#888',
  },
  mainValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 24,
  },
  valueAmount: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#fff',
  },
  valueCurrency: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4F46E5',
    marginLeft: 8,
  },
  breakdown: {
    gap: 12,
    marginBottom: 16,
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#0c0c0c',
    borderRadius: 8,
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#888',
  },
  breakdownValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  disclaimer: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
    textAlign: 'center',
  },
});