import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Speech from 'expo-speech';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const COLORS = {
  background: '#0F172A',
  surface: '#1E293B',
  surfaceLight: '#334155',
  primary: '#3B82F6',
  primaryDark: '#2563EB',
  success: '#22C55E',
  text: '#F1F5F9',
  textMuted: '#94A3B8',
  border: '#334155',
};

export default function CameraScreen() {
  const cameraRef = useRef<any>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [ip, setIp] = useState('');
  const [port, setPort] = useState('8080');
  const [image, setImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [plates, setPlates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const apiUrl = ip && port ? `http://${ip}:${port}` : '';

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    if (!ip) {
      Alert.alert('Error', 'Por favor ingresa la dirección IP del servidor.');
      return;
    }

    try {
      setLoading(true);
      const photo = await cameraRef.current.takePictureAsync({ base64: true });
      setImage(photo.uri);
      setPlates([]);
      setProcessedImage(null);

      const fullUrl = `${apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl}/predict_json/`;
      console.log('📤 Enviando imagen base64 a:', fullUrl);

      const jsonBody = JSON.stringify({ image_base64: photo.base64 });

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: jsonBody,
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('❌ Error HTTP:', response.status, text);
        Alert.alert('Error HTTP', `Código: ${response.status}`);
        Speech.speak('Ocurrió un error al contactar el servidor.');
        return;
      }

      const data = await response.json();
      console.log('📥 Respuesta del servidor:', data);

      if (data?.placas && data.placas.length > 0) {
        const detected = data.placas;
        setPlates(detected);

        if (data.image) {
          setProcessedImage(`data:image/jpeg;base64,${data.image}`);
        }

        const textToSpeak =
          detected.length === 1
            ? `La placa detectada es ${detected[0].split('').join(' ')}`
            : `Se detectaron ${detected.length} placas: ${detected.join(', ')}`;

        if (Platform.OS !== 'web') {
          Speech.speak(textToSpeak, { language: 'es-ES' });
        }
      } else if (data?.placas?.length === 0) {
        if (Platform.OS !== 'web') Speech.speak('No se detectaron placas.');
        Alert.alert('Resultado', 'No se detectaron placas.');
        setPlates([]);
        setProcessedImage(null);
      } else if (data?.error) {
        Alert.alert('Error del servidor', data.error);
        if (Platform.OS !== 'web') Speech.speak('Ocurrió un error en el servidor.');
      } else {
        console.warn('⚠️ Respuesta inesperada:', data);
        Alert.alert('Respuesta inesperada', JSON.stringify(data));
      }
    } catch (error) {
      console.error('❌ Error enviando imagen:', error);
      Alert.alert('Error', 'No se pudo conectar al servidor.');
      if (Platform.OS !== 'web') Speech.speak('No se pudo conectar al servidor.');
    } finally {
      setLoading(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.centerText}>Solicitando permisos...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerScreen}>
        <Text style={styles.centerIcon}>📷</Text>
        <Text style={styles.centerText}>Se necesita permiso para usar la cámara.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Conceder permiso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🚘 Detector de Placas</Text>
          <Text style={styles.headerSubtitle}>YOLOv8 + OCR</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Servidor</Text>
          <View style={styles.row}>
            <View style={{ flex: 2, marginRight: 8 }}>
              <Text style={styles.label}>Dirección IP</Text>
              <TextInput
                style={styles.input}
                placeholder="192.168.1.45"
                placeholderTextColor={COLORS.textMuted}
                value={ip}
                onChangeText={setIp}
                autoCapitalize="none"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Puerto</Text>
              <TextInput
                style={styles.input}
                placeholder="8080"
                placeholderTextColor={COLORS.textMuted}
                value={port}
                onChangeText={setPort}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        <View style={styles.cameraCard}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back" />
        </View>

        <TouchableOpacity
          style={[styles.captureButton, loading && styles.captureButtonDisabled]}
          onPress={handleCapture}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.captureButtonText}>📸 Tomar foto</Text>
          )}
        </TouchableOpacity>

        {image && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Imagen capturada</Text>
            <Image source={{ uri: image }} style={styles.image} />
          </View>
        )}

        {processedImage && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Imagen procesada</Text>
            <Image source={{ uri: processedImage }} style={styles.image} resizeMode="contain" />
          </View>
        )}

        {plates.length > 0 && (
          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>PLACA DETECTADA</Text>
            {plates.map((p, i) => (
              <View key={i} style={styles.plateBadge}>
                <Text style={styles.plateText}>{p}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    padding: 16,
    paddingBottom: 40,
  },
  centerScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    padding: 24,
  },
  centerIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  centerText: {
    color: COLORS.text,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  header: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
    letterSpacing: 1,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
  },
  label: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  input: {
    height: 44,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.surfaceLight,
    color: COLORS.text,
    fontSize: 15,
  },
  cameraCard: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  camera: {
    width: '100%',
    height: 380,
  },
  captureButton: {
    width: '100%',
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
  },
  captureButtonDisabled: {
    backgroundColor: COLORS.surfaceLight,
  },
  captureButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  image: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceLight,
  },
  resultCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  resultLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.success,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  plateBadge: {
    backgroundColor: '#0B1220',
    borderWidth: 2,
    borderColor: COLORS.success,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  plateText: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});