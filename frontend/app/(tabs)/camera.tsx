import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface OCRResult {
  detected_text: string;
  vin?: string;
  license_plate?: string;
  extracted_data: {
    year?: number;
    has_vin: boolean;
    has_plate: boolean;
  };
}

export default function CameraScreen() {
  const { sessionToken } = useAuth();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<OCRResult | null>(null);

  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    const { status: cameraStatus } =
      await Camera.requestCameraPermissionsAsync();
    const { status: mediaStatus } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    setHasPermission(cameraStatus === 'granted' && mediaStatus === 'granted');
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setImageUri(result.assets[0].uri);
      await scanImage(result.assets[0].base64);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setImageUri(result.assets[0].uri);
      await scanImage(result.assets[0].base64);
    }
  };

  const scanImage = async (base64Image: string) => {
    try {
      setScanning(true);
      const response = await axios.post(
        `${BACKEND_URL}/api/ocr/scan-base64`,
        {
          image_base64: base64Image,
        },
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      setResult(response.data);
    } catch (error: any) {
      console.error('OCR scan failed:', error);
      Alert.alert(
        'Tarama Hatası',
        error.response?.data?.detail ||
          'Belge taraması yapılamadı. Lütfen tekrar deneyin.'
      );
    } finally {
      setScanning(false);
    }
  };

  const reset = () => {
    setImageUri(null);
    setResult(null);
  };

  if (hasPermission === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-off" size={64} color="#888" />
        <Text style={styles.permissionTitle}>Kamera İzni Gerekli</Text>
        <Text style={styles.permissionText}>
          Lütfen uygulama ayarlarından kamera ve galeri erişimi verin
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermissions}
        >
          <Text style={styles.permissionButtonText}>İzin Ver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Belge Tara</Text>
        <Text style={styles.headerSubtitle}>
          Araç belgelerini tarayın ve bilgileri otomatik çıkarın
        </Text>
      </View>

      {/* Image Preview or Placeholder */}
      <View style={styles.previewContainer}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.previewImage} />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="document-text" size={64} color="#333" />
            <Text style={styles.placeholderText}>
              Araç belgesi veya plakası fotoğrafı çekin
            </Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      {!imageUri && (
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={takePhoto}>
            <Ionicons name="camera" size={32} color="#fff" />
            <Text style={styles.actionButtonText}>Fotoğraf Çek</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
            <Ionicons name="images" size={32} color="#fff" />
            <Text style={styles.actionButtonText}>Galeriden Seç</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Scanning Indicator */}
      {scanning && (
        <View style={styles.scanningOverlay}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.scanningText}>Tarama yapılıyor...</Text>
        </View>
      )}

      {/* Results */}
      {result && (
        <View style={styles.resultContainer}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>Tarama Sonuçları</Text>
            <TouchableOpacity onPress={reset}>
              <Ionicons name="close-circle" size={24} color="#888" />
            </TouchableOpacity>
          </View>

          <View style={styles.resultCards}>
            {result.vin && (
              <View style={styles.resultCard}>
                <View style={styles.resultCardHeader}>
                  <Ionicons name="barcode" size={20} color="#10B981" />
                  <Text style={styles.resultCardTitle}>VIN Numarası</Text>
                </View>
                <Text style={styles.resultCardValue}>{result.vin}</Text>
              </View>
            )}

            {result.license_plate && (
              <View style={styles.resultCard}>
                <View style={styles.resultCardHeader}>
                  <Ionicons name="car" size={20} color="#4F46E5" />
                  <Text style={styles.resultCardTitle}>Plaka</Text>
                </View>
                <Text style={styles.resultCardValue}>{result.license_plate}</Text>
              </View>
            )}

            {result.extracted_data.year && (
              <View style={styles.resultCard}>
                <View style={styles.resultCardHeader}>
                  <Ionicons name="calendar" size={20} color="#F59E0B" />
                  <Text style={styles.resultCardTitle}>Yıl</Text>
                </View>
                <Text style={styles.resultCardValue}>
                  {result.extracted_data.year}
                </Text>
              </View>
            )}
          </View>

          {/* Detected Text */}
          {result.detected_text && (
            <View style={styles.detectedTextContainer}>
              <Text style={styles.detectedTextTitle}>Algılanan Metin:</Text>
              <Text style={styles.detectedText}>
                {result.detected_text.substring(0, 200)}
                {result.detected_text.length > 200 ? '...' : ''}
              </Text>
            </View>
          )}

          {/* Try Again Button */}
          <TouchableOpacity style={styles.tryAgainButton} onPress={reset}>
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.tryAgainButtonText}>Yeni Tarama</Text>
          </TouchableOpacity>
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
  permissionContainer: {
    flex: 1,
    backgroundColor: '#0c0c0c',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 24,
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  previewContainer: {
    margin: 24,
    aspectRatio: 4 / 3,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 16,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#4F46E5',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  scanningOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanningText: {
    marginTop: 16,
    fontSize: 16,
    color: '#fff',
  },
  resultContainer: {
    flex: 1,
    paddingHorizontal: 24,
    marginTop: 24,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  resultCards: {
    gap: 12,
    marginBottom: 16,
  },
  resultCard: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
  },
  resultCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  resultCardTitle: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  resultCardValue: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
  },
  detectedTextContainer: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  detectedTextTitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  detectedText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  tryAgainButton: {
    flexDirection: 'row',
    backgroundColor: '#4F46E5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  tryAgainButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});