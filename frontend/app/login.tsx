import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const { login } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Logo/Brand Section */}
        <View style={styles.brandSection}>
          <View style={styles.logoContainer}>
            <Ionicons name="car-sport" size={60} color="#4F46E5" />
          </View>
          <Text style={styles.brandName}>CARLYTICS</Text>
          <Text style={styles.tagline}>Araç Değerleme Platformu</Text>
        </View>

        {/* Features */}
        <View style={styles.features}>
          <View style={styles.feature}>
            <Ionicons name="calculator" size={24} color="#4F46E5" />
            <Text style={styles.featureText}>Anlık Değerleme</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="camera" size={24} color="#4F46E5" />
            <Text style={styles.featureText}>OCR Tarama</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="trending-up" size={24} color="#4F46E5" />
            <Text style={styles.featureText}>Piyasa Analizi</Text>
          </View>
        </View>

        {/* Login Button */}
        <TouchableOpacity style={styles.loginButton} onPress={login}>
          <Ionicons name="logo-google" size={24} color="#fff" />
          <Text style={styles.loginButtonText}>Google ile Giriş Yap</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Giriş yaparak Kullanım Koşulları ve Gizlilik Politikasını kabul
          ediyorsunuz
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logoContainer: {
    width: 100,
    height: 100,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  brandName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#888',
  },
  features: {
    marginBottom: 40,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  featureText: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 16,
    fontWeight: '500',
  },
  loginButton: {
    flexDirection: 'row',
    backgroundColor: '#4F46E5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  disclaimer: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
});