# 🚘 Detector de Placas Vehiculares — YOLOv8 + EasyOCR + App Móvil

Sistema de detección y reconocimiento de placas vehiculares mediante Deep Learning, compuesto por un backend en **FastAPI + YOLOv8 + EasyOCR** desplegado en **AWS EC2**, y una aplicación móvil desarrollada con **Expo (React Native)** que permite tomar una foto y obtener la placa detectada en tiempo real, incluyendo lectura por voz.

---

## 📐 Arquitectura del proyecto

```
┌─────────────────────┐          HTTP POST /predict_json/          ┌──────────────────────────┐
│   App Móvil (Expo)  │ ───────────────────────────────────────▶  │   Backend (AWS EC2)      │
│  - Cámara            │                                            │  FastAPI + YOLOv8 +      │
│  - Texto a voz (TTS) │ ◀───────────────────────────────────────  │  EasyOCR                 │
└─────────────────────┘        JSON: placas, imagen procesada      └──────────────────────────┘
```

1. La app móvil toma una foto con la cámara del dispositivo.
2. La imagen se envía en base64 al backend vía HTTP.
3. **YOLOv8** detecta la región de la placa dentro de la imagen.
4. **EasyOCR** extrae el texto alfanumérico de esa región.
5. El backend responde con la(s) placa(s) detectada(s) y la imagen procesada (con las cajas dibujadas).
6. La app muestra el resultado y lo lee en voz alta.

---

## 🗂️ Estructura del repositorio

```
proyecto/
├── app.py              # Backend FastAPI (correr en el EC2)
├── best.pt              # Modelo YOLOv8 entrenado (pesos)
└── venv/                 # Entorno virtual de Python (se crea en el servidor)

DetectorPlacas/
├── app/
│   └── index.tsx        # Pantalla principal de la app (cámara, UI, lógica)
├── app.json              # Configuración de Expo (permisos, plugins)
├── package.json           # Dependencias y entry point (expo-router)
└── ...
```

---

## ⚙️ Backend — FastAPI + YOLOv8 + EasyOCR (AWS EC2)

### Requisitos

- Instancia EC2 con Ubuntu (recomendado t2.large o superior, 32 GiB de disco)
- Puerto **8080** abierto en el grupo de seguridad (entrada TCP, IPv4)
- Python 3.10+
- Modelo entrenado `best.pt`

### Instalación

```bash
# Librerías del sistema necesarias para OpenCV
sudo apt update
sudo apt install -y libgl1 libglib2.0-0 python3-pip python3-venv

# Crear carpeta del proyecto y entorno virtual
mkdir proyecto && cd proyecto
python3 -m venv venv
source venv/bin/activate

# Dependencias de Python
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
pip install ultralytics fastapi uvicorn easyocr opencv-python-headless pillow numpy python-multipart
```

### Subir los archivos del modelo y del servidor

Desde tu PC local (PowerShell/Terminal), usando la llave `.pem` de tu instancia:

```powershell
scp -i "tu_clave.pem" best.pt app.py ubuntu@<tu_IP_publica>:/home/ubuntu/proyecto/
```

### Ejecutar el servidor

```bash
cd /home/ubuntu/proyecto
source venv/bin/activate
python3 app.py
```

El servidor queda escuchando en `http://0.0.0.0:8080`. La documentación interactiva (Swagger) está disponible en:

```
http://<tu_IP_publica>:8080/docs
```

### Endpoints disponibles

| Método | Ruta              | Descripción                                                          |
|--------|-------------------|-----------------------------------------------------------------------|
| GET    | `/`               | Verifica que el servidor esté corriendo.                              |
| POST   | `/predict/`       | Recibe imagen como `multipart/form-data` (archivo) o campo form-urlencoded `image_base64`. |
| POST   | `/predict_json/`  | Recibe imagen como JSON puro: `{ "image_base64": "..." }`. Usado por la app móvil. |

**Respuesta típica:**

```json
{
  "success": true,
  "placas": ["JNU540"],
  "num_placas": 1,
  "image": "<imagen procesada en base64>",
  "message": "OK"
}
```

### Variables de entorno configurables

| Variable      | Valor por defecto | Descripción                                  |
|---------------|--------------------|-----------------------------------------------|
| `MODEL_PATH`  | `best.pt`          | Ruta al modelo YOLOv8                         |
| `OCR_LANGS`   | `en`               | Idiomas para EasyOCR                          |
| `CONF_THRESH` | `0.25`             | Umbral mínimo de confianza para detecciones   |
| `PORT`        | `8080`             | Puerto del servidor                           |

Ejemplo para bajar el umbral de confianza temporalmente:

```bash
CONF_THRESH=0.1 python3 app.py
```

### Lógica de lectura de placas (post-procesamiento OCR)

Para evitar que EasyOCR confunda texto adicional de la placa (como el nombre del país, ej. "COLOMBIA") con el número real, el backend aplica un filtro en cascada:

1. **Patrón estricto**: prioriza texto que coincide exactamente con el formato de placa (3 letras + 2-4 dígitos, ej. `JNU540`).
2. **Patrón flexible**: si no hay coincidencia estricta, acepta texto alfanumérico de 5 a 8 caracteres que combine letras y números.
3. **Lista negra**: descarta explícitamente palabras conocidas como "COLOMBIA", "REPUBLICA", etc.
4. **Filtro final**: nunca acepta como placa un texto que no contenga al menos un dígito.

---

## 📱 App Móvil — Expo (React Native)

### Requisitos

- Node.js 18+ y npm 9+
- PowerShell con política de ejecución habilitada (`Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`)

### Instalación

```powershell
npm install -g expo-cli eas-cli

npx create-expo-app DetectorPlacas --template expo-template-blank-typescript
cd DetectorPlacas

npx expo install expo-camera expo-speech expo-image-manipulator expo-router expo-splash-screen expo-build-properties
npm install axios
```

### Configuración

En `package.json`, establecer el punto de entrada de Expo Router:

```json
"main": "expo-router/entry"
```

En `app.json`, agregar el plugin de permisos de cámara dentro de `expo.plugins`:

```json
[
  "expo-camera",
  { "cameraPermission": "Permitir acceso a la cámara para detectar placas" }
]
```

El código de la pantalla principal va en `app/index.tsx`.

### Ejecutar la app

```powershell
npx expo start -c
```

Escanea el código QR con la app **Expo Go** en tu celular, o presiona `w` para probar en el navegador.

### Uso

1. Ingresa la **IP pública** de tu instancia EC2 y el **puerto** (`8080` por defecto).
2. Concede permiso de cámara.
3. Presiona **"Tomar foto"** apuntando a un vehículo con la placa visible.
4. La app envía la imagen al backend y muestra:
   - La imagen capturada
   - La imagen procesada (con la placa resaltada)
   - El texto de la placa detectada, además de una lectura por voz del resultado.

### Generar el APK

```powershell
eas login
eas build:configure
eas build -p android --profile preview
```

Al finalizar, EAS entrega un enlace de descarga del `.apk` instalable en cualquier dispositivo Android.

---

## ⚠️ Notas importantes / Troubleshooting

- **La IP del EC2 puede cambiar**: si detienes y vuelves a iniciar la instancia (por ejemplo, en un AWS Academy Learner Lab), la IP pública cambia salvo que uses una Elastic IP. Actualiza la IP en la app cada vez.
- **Persistencia en EC2**: detener/iniciar la instancia NO borra los archivos ni las dependencias instaladas — solo hay que volver a activar el entorno virtual y correr `python3 app.py`.
- **Content-Type en las peticiones**: el endpoint `/predict/` requiere `multipart/form-data` porque acepta archivos (`UploadFile`). Para enviar JSON puro (como hace la app móvil), usar `/predict_json/`.
- **PowerShell y `curl`**: en Windows, `curl` es un alias de `Invoke-WebRequest` y no soporta bien `-F` (form-data). Usar `curl.exe` explícitamente para pruebas de línea de comandos.
- **Pruebas fotografiando una pantalla**: no son representativas — introducen reflejos, efecto muaré y pérdida de nitidez que degradan la lectura OCR. Para pruebas confiables, usar el archivo de imagen original o fotos reales de vehículos.

---

## 🔬 Limitaciones conocidas

- El modelo YOLOv8 (`best.pt`) fue entrenado con un dataset limitado, por lo que generaliza mejor en condiciones similares a las de entrenamiento (ángulo frontal, buena iluminación). Con ángulos, distancias o iluminación muy distintos, la tasa de detección puede disminuir.
- EasyOCR puede confundir caracteres visualmente similares (O/0, I/1, B/8), especialmente con placas reflectantes o mal iluminadas.
- El servidor corre sobre CPU (no GPU), por lo que el tiempo de respuesta depende del tamaño de la instancia EC2.

---

## 🧰 Stack tecnológico

| Componente        | Tecnología                          |
|--------------------|--------------------------------------|
| Detección de objetos | YOLOv8 (Ultralytics)               |
| OCR                 | EasyOCR                             |
| Backend / API       | FastAPI + Uvicorn                   |
| Infraestructura     | AWS EC2 (Ubuntu)                    |
| App móvil           | Expo (React Native + TypeScript)    |
| Cámara y voz        | expo-camera, expo-speech            |
