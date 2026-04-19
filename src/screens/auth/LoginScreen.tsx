import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Button, Text, TextInput, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { spacing } from '../../theme';
import { useAuthStore } from '../../store/authStore';

export default function LoginScreen(): React.JSX.Element {
  const theme = useTheme();
  const signIn = useAuthStore((s) => s.signIn);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    const err = await signIn(email.trim(), password);
    if (err) setError('이메일 또는 비밀번호가 올바르지 않습니다.');
    setLoading(false);
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* 로고 영역 */}
        <View style={styles.logoArea}>
          <MaterialCommunityIcons name="refresh-circle" size={56} color={theme.colors.primary} />
          <Text style={[styles.appName, { color: theme.colors.onBackground }]}>Doro</Text>
          <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            일정을 함께 관리하세요
          </Text>
        </View>

        {/* 입력 영역 */}
        <View style={styles.form}>
          <TextInput
            label="이메일"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            left={<TextInput.Icon icon="email-outline" />}
          />
          <TextInput
            label="비밀번호"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry={!showPassword}
            style={styles.input}
            left={<TextInput.Icon icon="lock-outline" />}
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                onPress={() => setShowPassword((v) => !v)}
              />
            }
            onSubmitEditing={handleLogin}
          />

          {error && (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
          )}

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            disabled={loading || !email.trim() || !password}
            style={styles.loginButton}
            contentStyle={styles.loginButtonContent}
          >
            로그인
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.xl,
  },
  logoArea: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
  },
  form: {
    gap: spacing.sm,
  },
  input: {
    // Paper TextInput 기본 스타일 활용
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
  },
  loginButton: {
    marginTop: spacing.xs,
    borderRadius: 12,
  },
  loginButtonContent: {
    paddingVertical: spacing.xs,
  },
});
