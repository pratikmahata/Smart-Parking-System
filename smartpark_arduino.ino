#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Servo.h>

// ============== RFID RC522 ==============
#define RFID_SS_PIN  8
#define RFID_RST_PIN 9

MFRC522 rfid(RFID_SS_PIN, RFID_RST_PIN);

// ============== LCD =====================
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ============== SERVOS ==================
Servo entryServo;
Servo exitServo;

const int entryServoPin = 6;
const int exitServoPin  = 7;

// ============== ENTRY ULTRASONIC =========
const int entryTrigPin = 2;
const int entryEchoPin = 3;

// ============== EXIT ULTRASONIC ==========
const int exitTrigPin = 4;
const int exitEchoPin = 5;

// ============== PARKING ==================
const int MAX_SLOTS = 6; // Matches the 6 slots in the SmartPark Dashboard
int availableSlots = MAX_SLOTS;

const int DETECTION_DISTANCE = 15; // Distance in cm to trigger gates

// ============== GATE TIMING ==============
const unsigned long GATE_OPEN_TIME = 3000;

bool entryGateOpen = false;
bool exitGateOpen = false;

unsigned long entryGateTime = 0;
unsigned long exitGateTime = 0;

// Prevent repeated counting while a vehicle remains detected
bool entryDetected = false;
bool exitDetected = false;

String lastScannedUID = "";
unsigned long lastTelemetryTime = 0;

// ============== SEND JSON TO WEB BRIDGE ==
void sendWebEvent(String eventType, String uid, float entryDist, float exitDist) {
  Serial.print("{\"type\":\"");
  Serial.print(eventType);
  Serial.print("\",\"uid\":\"");
  Serial.print(uid);
  Serial.print("\",\"entryDistance\":");
  Serial.print(entryDist, 1);
  Serial.print(",\"exitDistance\":");
  Serial.print(exitDist, 1);
  Serial.print(",\"entryGateOpen\":");
  Serial.print(entryGateOpen ? "true" : "false");
  Serial.print(",\"exitGateOpen\":");
  Serial.print(exitGateOpen ? "true" : "false");
  Serial.print(",\"availableSlots\":");
  Serial.print(availableSlots);
  Serial.print(",\"maxSlots\":");
  Serial.print(MAX_SLOTS);
  Serial.println("}");
}

// ============== ULTRASONIC FUNCTION ======
float getDistance(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);

  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);

  digitalWrite(trigPin, LOW);

  long duration = pulseIn(echoPin, HIGH, 25000);

  if (duration == 0) {
    return 999;
  }

  return duration * 0.0343 / 2;
}

// ============== LCD UPDATE ===============
void updateLCD() {
  lcd.setCursor(0, 0);
  lcd.print("Smart Parking   ");

  lcd.setCursor(0, 1);
  lcd.print("Available: ");
  lcd.print(availableSlots);
  lcd.print("   ");
}

// ============== SETUP ====================
void setup() {
  Serial.begin(9600);

  // Keep Nano in SPI master mode
  pinMode(10, OUTPUT);
  digitalWrite(10, HIGH);

  // RFID
  SPI.begin();
  rfid.PCD_Init();
  delay(50);

  // LCD
  lcd.init();
  lcd.backlight();

  // Ultrasonic sensors
  pinMode(entryTrigPin, OUTPUT);
  pinMode(entryEchoPin, INPUT);

  pinMode(exitTrigPin, OUTPUT);
  pinMode(exitEchoPin, INPUT);

  // Servos
  entryServo.attach(entryServoPin);
  exitServo.attach(exitServoPin);

  // Initialize gates to closed position (0 degrees)
  entryServo.write(0);
  exitServo.write(0);

  updateLCD();
  sendWebEvent("INIT", "", 999, 999);
}

// ============== MAIN LOOP ================
void loop() {
  unsigned long currentTime = millis();

  float entryDistance = getDistance(entryTrigPin, entryEchoPin);
  float exitDistance  = getDistance(exitTrigPin, exitEchoPin);

  // ---------------------------------------
  // 1. RFID SCANNING
  // ---------------------------------------
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    String uidStr = "";
    for (byte i = 0; i < rfid.uid.size; i++) {
      if (rfid.uid.uidByte[i] < 0x10) {
        uidStr += "0";
      }
      uidStr += String(rfid.uid.uidByte[i], HEX);
      if (i < rfid.uid.size - 1) {
        uidStr += ":";
      }
    }
    uidStr.toUpperCase();
    lastScannedUID = uidStr;

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("RFID Detected");
    lcd.setCursor(0, 1);
    lcd.print(uidStr);

    sendWebEvent("RFID", uidStr, entryDistance, exitDistance);

    delay(1000);
    updateLCD();

    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
  }

  // ---------------------------------------
  // 2. ENTRY GATE
  // ---------------------------------------
  if (entryDistance <= DETECTION_DISTANCE && !entryDetected) {
    entryDetected = true;

    if (availableSlots > 0) {
      availableSlots--;

      entryServo.write(90); // Open Entry Gate
      entryGateOpen = true;
      entryGateTime = currentTime;

      updateLCD();
      sendWebEvent("ENTRY", lastScannedUID, entryDistance, exitDistance);
      lastScannedUID = ""; // Clear after vehicle enters
    } else {
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Parking Full");
      sendWebEvent("FULL", lastScannedUID, entryDistance, exitDistance);
      delay(1000);
      updateLCD();
    }
  }

  // Rearm entry detection after vehicle leaves
  if (entryDistance > 18) {
    entryDetected = false;
  }

  // Automatically close entry gate
  if (entryGateOpen && (currentTime - entryGateTime >= GATE_OPEN_TIME)) {
    entryServo.write(0); // Close Entry Gate
    entryGateOpen = false;
    updateLCD();
    sendWebEvent("GATE_CLOSE", "", entryDistance, exitDistance);
  }

  // ---------------------------------------
  // 3. EXIT GATE
  // ---------------------------------------
  if (exitDistance <= DETECTION_DISTANCE && !exitDetected) {
    exitDetected = true;

    if (availableSlots < MAX_SLOTS) {
      availableSlots++;

      exitServo.write(90); // Open Exit Gate
      exitGateOpen = true;
      exitGateTime = currentTime;

      updateLCD();
      sendWebEvent("EXIT", "", entryDistance, exitDistance);
    } else {
      sendWebEvent("EMPTY", "", entryDistance, exitDistance);
    }
  }

  // Rearm exit detection after vehicle leaves
  if (exitDistance > 18) {
    exitDetected = false;
  }

  // Automatically close exit gate
  if (exitGateOpen && (currentTime - exitGateTime >= GATE_OPEN_TIME)) {
    exitServo.write(0); // Close Exit Gate
    exitGateOpen = false;
    updateLCD();
    sendWebEvent("GATE_CLOSE", "", entryDistance, exitDistance);
  }

  // Periodic live telemetry heartbeat every 1 second
  if (currentTime - lastTelemetryTime >= 1000) {
    lastTelemetryTime = currentTime;
    sendWebEvent("TELEMETRY", lastScannedUID, entryDistance, exitDistance);
  }

  delay(50);
}
