#include <Wire.h>
#include "MAX30105.h"
#include "heartRate.h"
#include "spo2_algorithm.h"
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// MAX30102 Sensor
MAX30105 particleSensor;

// BLE Configuration - KEEPING YOUR EXACT UUIDs
#define SERVICE_UUID "12345678-1234-1234-1234-123456789abc"
#define HEART_RATE_UUID "87654321-4321-4321-4321-cba987654321"
#define SPO2_UUID "11111111-2222-3333-4444-555555555555"
#define STATUS_UUID "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

BLEServer* pServer = NULL;
BLECharacteristic* heartRateCharacteristic = NULL;
BLECharacteristic* spo2Characteristic = NULL;
BLECharacteristic* statusCharacteristic = NULL;
bool deviceConnected = false;

// Enhanced Sensor Data Variables
#define BUFFER_SIZE 100
uint32_t irBuffer[BUFFER_SIZE];
uint32_t redBuffer[BUFFER_SIZE];
int32_t spo2Value = 0;
int8_t validSPO2 = 0;
int32_t heartRateValue = 0;
int8_t validHeartRate = 0;

// Enhanced averaging and stabilization
#define AVG_SIZE 7
int32_t hrHistory[AVG_SIZE] = { 0 };
int32_t spo2History[AVG_SIZE] = { 0 };
int avgIndex = 0;
int validReadingCount = 0;
unsigned long lastReadingTime = 0;
int consecutiveValidReadings = 0;
bool fingerStable = false;

// Improved finger detection variables
uint32_t fingerBaseline = 0;
int fingerStabilityCounter = 0;
bool fingerDetected = false;

// Enhanced finger detection with baseline calibration
bool isFingerPresent() {
  uint32_t currentIR = particleSensor.getIR();

  // Dynamic threshold - more sensitive detection
  if (currentIR > 20000) {
    if (!fingerDetected) {
      fingerBaseline = currentIR;
      fingerStabilityCounter = 0;
      fingerDetected = true;
      Serial.println("👆 Finger detected - stabilizing...");
    } else {
      // Check if finger reading is stable
      if (abs((long)currentIR - (long)fingerBaseline) < 10000) {
        fingerStabilityCounter++;
        if (fingerStabilityCounter >= 3) {
          fingerStable = true;
        }
      } else {
        fingerStabilityCounter = 0;
        fingerBaseline = currentIR;
      }
    }
    return true;
  } else {
    // Reset finger detection
    fingerDetected = false;
    fingerStable = false;
    fingerStabilityCounter = 0;
    consecutiveValidReadings = 0;
    return false;
  }
}

// Improved stability checking
int32_t getStableHeartRate() {
  if (validReadingCount == 0) return 0;

  int32_t sum = 0;
  int count = min(validReadingCount, AVG_SIZE);

  // Remove outliers before averaging
  int32_t tempArray[AVG_SIZE];
  for (int i = 0; i < count; i++) {
    tempArray[i] = hrHistory[i];
  }

  // Simple outlier removal
  for (int i = 0; i < count; i++) {
    if (tempArray[i] >= 45 && tempArray[i] <= 200) {
      sum += tempArray[i];
    } else {
      count--;
    }
  }

  return count > 0 ? sum / count : 0;
}

int32_t getStableSpO2() {
  if (validReadingCount == 0) return 0;

  int32_t sum = 0;
  int count = min(validReadingCount, AVG_SIZE);

  for (int i = 0; i < count; i++) {
    if (spo2History[i] >= 80 && spo2History[i] <= 100) {
      sum += spo2History[i];
    } else {
      count--;
    }
  }

  return count > 0 ? sum / count : 0;
}

// BLE Server Callbacks
class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
    Serial.println("📱 Mobile App Connected!");
  };

  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    Serial.println("📱 Mobile App Disconnected!");
    BLEDevice::startAdvertising();
  }
};

void setup() {
  Serial.begin(115200);
  Serial.println("=================================");
  Serial.println("HealthTrack BLE - Enhanced Version");
  Serial.println("=================================");

  // Initialize I2C and MAX30102 Sensor
  Wire.begin(8, 9);  // SDA=GPIO8, SCL=GPIO9
  delay(500);

  if (!particleSensor.begin()) {
    Serial.println("❌ MAX30102 sensor not found!");
    while (1)
      ;
  }

  Serial.println("✅ MAX30102 sensor initialized");

  // VERY SENSITIVE sensor configuration for detection
  byte ledBrightness = 70;
  byte sampleAverage = 4;
  byte ledMode = 2;
  byte sampleRate = 100;
  int pulseWidth = 411;
  int adcRange = 16384;

  particleSensor.setup(ledBrightness, sampleAverage, ledMode, sampleRate, pulseWidth, adcRange);
  particleSensor.setPulseAmplitudeRed(0x1F);
  particleSensor.setPulseAmplitudeIR(0x1F);
  particleSensor.setPulseAmplitudeGreen(0);

  // Additional sensor optimizations
  particleSensor.enableDIETEMPRDY();

  Serial.println("✅ Sensor configured with enhanced settings");

  // BLE initialization - CRITICAL FIX: Use "HealthTR" to match nRF Connect
  BLEDevice::init("HealthTR");

  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService* pService = pServer->createService(SERVICE_UUID);

  heartRateCharacteristic = pService->createCharacteristic(
    HEART_RATE_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_NOTIFY);
  heartRateCharacteristic->addDescriptor(new BLE2902());

  spo2Characteristic = pService->createCharacteristic(
    SPO2_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_NOTIFY);
  spo2Characteristic->addDescriptor(new BLE2902());

  statusCharacteristic = pService->createCharacteristic(
    STATUS_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_NOTIFY);
  statusCharacteristic->addDescriptor(new BLE2902());

  pService->start();

  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);  // <-- Must be true to broadcast device name
  pAdvertising->setMinPreferred(0x06);  // Recommended for iOS/Android compatibility
  pAdvertising->setMinPreferred(0x12);  // Helps with connection stability

  BLEDevice::startAdvertising();
  ;

  Serial.println("✅ BLE Server started");
  Serial.println("📡 Advertising as 'HealthTR'");  // Updated message
  Serial.println("📱 Ready for mobile app connection!");
  Serial.println("=================================");
  Serial.println("📍 Place finger firmly on sensor...\n");
}

void loop() {
  // Enhanced finger detection
  if (!isFingerPresent()) {
    if (deviceConnected) {
      statusCharacteristic->setValue("NO_FINGER");
      statusCharacteristic->notify();
    }
    Serial.println("⏳ Place finger on sensor...");
    delay(1000);
    return;
  }

  // Wait for finger to stabilize before taking readings
  if (!fingerStable) {
    if (deviceConnected) {
      statusCharacteristic->setValue("STABILIZING");
      statusCharacteristic->notify();
    }
    Serial.println("🔄 Finger detected - stabilizing...");
    delay(500);
    return;
  }

  Serial.println("📊 Taking measurement...");

  // Collect samples with improved timing
  for (int i = 0; i < BUFFER_SIZE; i++) {
    while (!particleSensor.available()) {
      particleSensor.check();
      if (!isFingerPresent()) {
        Serial.println("⚠️ Finger moved during reading");
        return;
      }
    }

    redBuffer[i] = particleSensor.getRed();
    irBuffer[i] = particleSensor.getIR();
    particleSensor.nextSample();

    // Check for signal quality during collection
    if (redBuffer[i] < 10000 || irBuffer[i] < 10000) {
      Serial.println("⚠️ Weak signal - press finger more firmly");
      if (deviceConnected) {
        statusCharacteristic->setValue("WEAK_SIGNAL");
        statusCharacteristic->notify();
      }
      delay(1000);
      return;
    }
  }

  // Calculate heart rate and SpO2
  maxim_heart_rate_and_oxygen_saturation(irBuffer, BUFFER_SIZE, redBuffer,
                                         &spo2Value, &validSPO2,
                                         &heartRateValue, &validHeartRate);

  // More lenient validation - allow wider ranges initially
  if (validHeartRate && validSPO2) {

    // Store raw values first
    bool hrValid = (heartRateValue >= 40 && heartRateValue <= 220);
    bool spo2Valid = (spo2Value >= 70 && spo2Value <= 100);

    if (hrValid && spo2Valid) {
      // Store in history
      hrHistory[avgIndex] = heartRateValue;
      spo2History[avgIndex] = spo2Value;
      avgIndex = (avgIndex + 1) % AVG_SIZE;

      if (validReadingCount < AVG_SIZE) {
        validReadingCount++;
      }

      consecutiveValidReadings++;

      // Only send data after we have enough stable readings
      if (consecutiveValidReadings >= 3) {
        int32_t stableHR = getStableHeartRate();
        int32_t stableSpO2 = getStableSpO2();

        // Final validation of averaged values
        if (stableHR >= 50 && stableHR <= 180 && stableSpO2 >= 85 && stableSpO2 <= 100) {

          Serial.println("=== STABLE READINGS ===");
          Serial.print("❤️  Heart Rate: ");
          Serial.print(stableHR);
          Serial.println(" bpm");

          Serial.print("🫁 SpO2: ");
          Serial.print(stableSpO2);
          Serial.println("%");

          // Send data via BLE
          if (deviceConnected) {
            String hrData = String(stableHR);
            heartRateCharacteristic->setValue(hrData.c_str());
            heartRateCharacteristic->notify();

            String spo2Data = String(stableSpO2);
            spo2Characteristic->setValue(spo2Data.c_str());
            spo2Characteristic->notify();

            statusCharacteristic->setValue("OK");
            statusCharacteristic->notify();

            Serial.println("📱 Data sent to mobile app!");
          }

          Serial.println("=================================");

        } else {
          Serial.println("⚠️ Averaged values out of range - continuing...");
          if (deviceConnected) {
            statusCharacteristic->setValue("CALCULATING");
            statusCharacteristic->notify();
          }
        }
      } else {
        Serial.println("🔄 Building stable reading... (" + String(consecutiveValidReadings) + "/3)");
        if (deviceConnected) {
          statusCharacteristic->setValue("CALCULATING");
          statusCharacteristic->notify();
        }
      }

    } else {
      Serial.println("⚠️ Raw reading out of range - HR:" + String(heartRateValue) + " SpO2:" + String(spo2Value));
      consecutiveValidReadings = 0;
      if (deviceConnected) {
        statusCharacteristic->setValue("INVALID_READING");
        statusCharacteristic->notify();
      }
    }

  } else {
    Serial.println("⚠️ Algorithm validation failed - check finger placement");
    consecutiveValidReadings = 0;
    if (deviceConnected) {
      statusCharacteristic->setValue("POOR_SIGNAL");
      statusCharacteristic->notify();
    }
  }

  // Adaptive delay based on reading quality
  delay(consecutiveValidReadings >= 3 ? 3000 : 1500);
}
