import React, {useState} from 'react';
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
import {colors, fontFamily, shadows} from '../theme';

const API_URL = 'https://vtms.co.in/api/supervisor/request-otp.php';

export default function LoginScreen({navigation}) {
  const [mobileNumber, setMobileNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOTP = async () => {
    const trimmed = mobileNumber.trim();
    if (trimmed.length < 10) {
      setError('Enter a valid mobile number');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({mobile_number: trimmed}),
      });
      const data = await response.json();
      if (data.status === 'success') {
        navigation.navigate('OTP', {mobileNumber: trimmed});
      } else {
        setError(data.message || 'Failed to send OTP');
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
      <View style={styles.brandArea}>
        <View style={styles.logo}>
          <MaterialCommunityIcons
            name="account-hard-hat-outline"
            size={35}
            color={colors.white}
          />
        </View>
        <Text style={styles.brand}>VT Staff</Text>
        <Text style={styles.tagline}>One place for your workday</Text>
      </View>

      <View style={styles.sheet}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>
          Sign in with your registered mobile number.
        </Text>
        <Text style={styles.label}>Mobile number</Text>
        <View style={[styles.inputWrap, error && styles.inputError]}>
          <View style={styles.countryCode}>
            <Text style={styles.countryText}>+91</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Enter 10-digit number"
            placeholderTextColor="#9AA7AC"
            value={mobileNumber}
            onChangeText={text => {
              setMobileNumber(text.replace(/[^0-9]/g, ''));
              setError('');
            }}
            keyboardType="phone-pad"
            editable={!loading}
            maxLength={10}
          />
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <TouchableOpacity
          style={[styles.button, loading && styles.disabled]}
          onPress={handleSendOTP}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Text style={styles.buttonText}>Send OTP</Text>
              <MaterialCommunityIcons
                name="arrow-right"
                size={20}
                color={colors.white}
              />
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.terms}>
          By continuing, you agree to the organisation's staff app policy.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.primaryDark,
    justifyContent: 'flex-end',
  },
  brandArea: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  logo: {
    width: 72,
    height: 72,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#34788B',
  },
  brand: {
    color: colors.white,
    fontFamily: fontFamily.bold,
    fontSize: 29,
    marginTop: 14,
  },
  tagline: {
    color: '#AFCBD3',
    fontFamily: fontFamily.regular,
    fontSize: 12,
    marginTop: 3,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 35,
    ...shadows.card,
  },
  title: {
    color: colors.text,
    fontFamily: fontFamily.semibold,
    fontSize: 23,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 24,
  },
  label: {
    color: colors.text,
    fontFamily: fontFamily.medium,
    fontSize: 12,
    marginBottom: 8,
  },
  inputWrap: {
    height: 56,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputError: {borderColor: colors.danger},
  countryCode: {
    height: 32,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  countryText: {
    color: colors.text,
    fontFamily: fontFamily.medium,
    fontSize: 14,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontFamily: fontFamily.medium,
    fontSize: 14,
    paddingHorizontal: 14,
  },
  errorText: {
    color: colors.danger,
    fontFamily: fontFamily.regular,
    fontSize: 11,
    marginTop: 7,
  },
  button: {
    height: 56,
    borderRadius: 17,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 18,
  },
  disabled: {opacity: 0.65},
  buttonText: {
    color: colors.white,
    fontFamily: fontFamily.semibold,
    fontSize: 14,
  },
  terms: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 9,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: 17,
    paddingHorizontal: 30,
  },
});
