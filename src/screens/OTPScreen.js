/**
 * OTP Screen - Enter OTP and verify
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://vtms.co.in/api/supervisor/verify-otp.php';
const TOKEN_KEY = '@vtstaff_jwt_token';

export default function OTPScreen({ route, navigation }) {
  const { mobileNumber } = route.params || {};
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerifyOTP = async () => {
    const trimmedOtp = otp.trim();
    if (!trimmedOtp) {
      setError('Please enter OTP');
      return;
    }
    if (!mobileNumber) {
      setError('Mobile number missing. Go back and try again.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: mobileNumber,
          otp: trimmedOtp,
        }),
      });
      const data = await response.json();
      if (response.status === 200 && (data.status === 200 || data.status === 'success')) {
        const token =
          data.token ||
          data.jwt ||
          data.access_token ||
          data.data?.token ||
          data.data?.jwt ||
          data.data?.access_token;
        if (token) {
          await AsyncStorage.setItem(TOKEN_KEY, token);
        } else {
          setError('Login succeeded but no token received. Check API response.');
          setLoading(false);
          return;
        }
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      } else {
        setError(data.message || 'Invalid OTP. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Verify OTP / ओटीपी सत्यापित करें</Text>
        <Text style={styles.hint}>Code sent to / कोड भेजा गया है: {mobileNumber || 'your number'}</Text>
        <Text style={styles.label}>OTP / ओटीपी</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter OTP / ओटीपी दर्ज करें"
          placeholderTextColor="#999"
          value={otp}
          onChangeText={(text) => {
            setOtp(text);
            setError('');
          }}
          keyboardType="number-pad"
          editable={!loading}
          maxLength={8}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleVerifyOTP}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Verify OTP / ओटीपी सत्यापित करें</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
  },
  content: {
    padding: 24,
    marginHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
    textAlign: 'center',
  },
  hint: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  errorText: {
    color: '#c00',
    fontSize: 14,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#34C759',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
