import React, {useRef, useState} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {storeAuthSession} from '../services/staffApi';
import {colors, fontFamily} from '../theme';

const API_URL = 'https://vtms.co.in/api/supervisor/verify-otp.php';

export default function OTPScreen({route, navigation}) {
  const {mobileNumber} = route.params || {};
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const handleVerifyOTP = async () => {
    if (otp.trim().length < 4) {
      setError('Enter the OTP sent to your phone');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({phone: mobileNumber, otp: otp.trim()}),
      });
      const data = await response.json();
      const token =
        data.token ||
        data.jwt ||
        data.access_token ||
        data.data?.token ||
        data.data?.jwt ||
        data.data?.access_token;
      const user = data.user || data.data?.user || null;
      if (
        response.status === 200 &&
        (data.status === 200 || data.status === 'success') &&
        token
      ) {
        await storeAuthSession(token, user);
        navigation.reset({index: 0, routes: [{name: 'Main'}]});
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
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <MaterialCommunityIcons
          name="arrow-left"
          size={24}
          color={colors.text}
        />
      </TouchableOpacity>
      <View style={styles.content}>
        <View style={styles.icon}>
          <MaterialCommunityIcons
            name="message-lock-outline"
            size={31}
            color={colors.primary}
          />
        </View>
        <Text style={styles.title}>Verify your number</Text>
        <Text style={styles.subtitle}>
          Enter the code sent to +91 {mobileNumber || ''}
        </Text>

        <TouchableOpacity
          activeOpacity={1}
          style={styles.codeRow}
          onPress={() => inputRef.current?.focus()}>
          {[0, 1, 2, 3, 4, 5].map(index => (
            <View
              key={index}
              style={[
                styles.codeBox,
                otp[index] && styles.codeBoxFilled,
                index === otp.length && styles.codeBoxActive,
              ]}>
              <Text style={styles.codeText}>{otp[index] || ''}</Text>
            </View>
          ))}
        </TouchableOpacity>
        <TextInput
          ref={inputRef}
          value={otp}
          onChangeText={text => {
            setOtp(text.replace(/[^0-9]/g, '').slice(0, 6));
            setError('');
          }}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          style={styles.hiddenInput}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.disabled]}
          onPress={handleVerifyOTP}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Verify and continue</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.resend}>
          Didn't receive the code?{' '}
          <Text style={styles.resendLink}>Resend OTP</Text>
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.background},
  back: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 45,
    marginLeft: 16,
  },
  content: {flex: 1, paddingHorizontal: 24, paddingTop: 55},
  icon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.text,
    fontFamily: fontFamily.semibold,
    fontSize: 24,
    marginTop: 20,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    marginTop: 5,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 35,
  },
  codeBox: {
    width: 47,
    height: 58,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBoxActive: {borderColor: colors.primary, borderWidth: 1.5},
  codeBoxFilled: {backgroundColor: colors.primarySoft},
  codeText: {
    color: colors.text,
    fontFamily: fontFamily.semibold,
    fontSize: 20,
  },
  hiddenInput: {position: 'absolute', opacity: 0, width: 1, height: 1},
  error: {
    color: colors.danger,
    fontFamily: fontFamily.regular,
    fontSize: 11,
    marginTop: 12,
  },
  button: {
    height: 56,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  disabled: {opacity: 0.65},
  buttonText: {
    color: colors.white,
    fontFamily: fontFamily.semibold,
    fontSize: 14,
  },
  resend: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 20,
  },
  resendLink: {color: colors.primary, fontFamily: fontFamily.semibold},
});
