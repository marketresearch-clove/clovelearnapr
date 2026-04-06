/**
 * WhatsApp API Test Script
 * Quick test to verify WhatsApp integration is working
 */

import fetch from "node-fetch";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

interface TestResult {
  name: string;
  status: "✓" | "✗";
  message: string;
  details?: any;
}

const results: TestResult[] = [];

async function testEnvironmentVariables() {
  console.log("\n🔧 Testing Environment Variables...\n");

  const required = [
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_VERIFY_TOKEN",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "LMS_BASE_URL",
  ];

  for (const variable of required) {
    const value = process.env[variable];
    const status = value ? "✓" : "✗";
    const message = value ? `Set (${value.substring(0, 20)}...)` : "Missing";

    results.push({
      name: variable,
      status: value ? "✓" : "✗",
      message,
    });

    console.log(`  ${status} ${variable}: ${message}`);
  }
}

async function testWhatsAppConnection() {
  console.log("\n📱 Testing WhatsApp API Connection...\n");

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    results.push({
      name: "WhatsApp API Connection",
      status: "✗",
      message: "Missing credentials",
    });
    console.log("  ✗ Missing credentials\n");
    return;
  }

  try {
    const url = `https://graph.facebook.com/v18.0/me?fields=id,name`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      results.push({
        name: "WhatsApp API Connection",
        status: "✓",
        message: "Connected successfully",
        details: data,
      });
      console.log("  ✓ Connected successfully");
      console.log(`  Response:`, data);
    } else {
      const error = await response.text();
      results.push({
        name: "WhatsApp API Connection",
        status: "✗",
        message: `HTTP ${response.status}`,
        details: error,
      });
      console.log(`  ✗ HTTP ${response.status}: ${error}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({
      name: "WhatsApp API Connection",
      status: "✗",
      message: message,
    });
    console.log(`  ✗ Error: ${message}\n`);
  }
}

async function testSupabaseConnection() {
  console.log("\n🗄️  Testing Supabase Connection...\n");

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    results.push({
      name: "Supabase Connection",
      status: "✗",
      message: "Missing credentials",
    });
    console.log("  ✗ Missing credentials\n");
    return;
  }

  try {
    const url = `${supabaseUrl}/rest/v1/profiles?select=COUNT(*)&head=true`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      results.push({
        name: "Supabase Connection",
        status: "✓",
        message: "Connected successfully",
      });
      console.log("  ✓ Connected successfully");
    } else {
      const error = await response.text();
      results.push({
        name: "Supabase Connection",
        status: "✗",
        message: `HTTP ${response.status}`,
        details: error,
      });
      console.log(`  ✗ HTTP ${response.status}: ${error}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({
      name: "Supabase Connection",
      status: "✗",
      message: message,
    });
    console.log(`  ✗ Error: ${message}\n`);
  }
}

async function testPhoneNumberFormat() {
  console.log("\n📞 Testing Phone Number Format...\n");

  const testNumbers = [
    { number: "+919876543210", valid: true, description: "India format" },
    { number: "+13105551234", valid: true, description: "US format" },
    { number: "919876543210", valid: false, description: "Missing +" },
    { number: "+1", valid: false, description: "Too short" },
  ];

  for (const test of testNumbers) {
    // Simple validation: starts with +, followed by digits, min 10 digits
    const regex = /^\+\d{10,}$/;
    const isValid = regex.test(test.number);
    const status = isValid === test.valid ? "✓" : "✗";
    const message = isValid ? "Valid" : "Invalid";

    results.push({
      name: `Phone Format: ${test.description}`,
      status: status,
      message: `${test.number} - ${message}`,
    });

    console.log(`  ${status} ${test.number} - ${message}`);
  }
}

async function testWebhookConfiguration() {
  console.log("\n🔗 Testing Webhook Configuration...\n");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!verifyToken) {
    results.push({
      name: "Webhook Configuration",
      status: "✗",
      message: "Verify token not set",
    });
    console.log("  ✗ Verify token not set");
    return;
  }

  // Simulate webhook verification
  const mode = "subscribe";
  const token = "test_token";
  const challenge = "test_challenge";

  if (mode === "subscribe" && token === verifyToken) {
    results.push({
      name: "Webhook Configuration",
      status: "✓",
      message: "Verify token correct",
    });
    console.log("  ✓ Verify token configured correctly");
  } else if (mode === "subscribe" && token !== verifyToken) {
    results.push({
      name: "Webhook Configuration",
      status: "✗",
      message: "Verify token mismatch",
    });
    console.log("  ✗ Verify token mismatch");
  }
}

async function generateReport() {
  console.log("\n" + "=".repeat(60));
  console.log("  WhatsApp Integration Test Report");
  console.log("=".repeat(60) + "\n");

  const passed = results.filter((r) => r.status === "✓").length;
  const failed = results.filter((r) => r.status === "✗").length;

  console.log(`Results: ${passed} passed, ${failed} failed\n`);

  for (const result of results) {
    console.log(`${result.status} ${result.name}`);
    console.log(`   ${result.message}`);
    if (result.details) {
      console.log(`   Details: ${JSON.stringify(result.details)}`);
    }
  }

  console.log("\n" + "=".repeat(60) + "\n");

  if (failed === 0) {
    console.log("✓ All tests passed! Your WhatsApp integration is ready.\n");
    console.log("Next steps:");
    console.log("  1. Create message templates in Meta Business Manager");
    console.log("  2. Deploy Edge Functions: supabase functions deploy ...");
    console.log("  3. Configure webhook in Meta Dashboard");
    console.log("  4. Send test notification: npm run whatsapp test [userId]");
  } else {
    console.log("✗ Some tests failed. Please fix the issues above.\n");
    console.log("Common fixes:");
    console.log("  - Check .env.local file exists and has all variables");
    console.log("  - Verify WhatsApp access token is current");
    console.log("  - Confirm Supabase credentials are correct");
    console.log("  - Check internet connection");
  }
}

async function runAllTests() {
  console.log("\n");
  console.log("🧪 WhatsApp Integration Test Suite");
  console.log("Date:", new Date().toLocaleString());
  console.log("=".repeat(60));

  await testEnvironmentVariables();
  await testPhoneNumberFormat();
  await testWhatsAppConnection();
  await testSupabaseConnection();
  await testWebhookConfiguration();
  await generateReport();

  process.exit(results.some((r) => r.status === "✗") ? 1 : 0);
}

// Run tests
runAllTests().catch((error) => {
  console.error("Test suite error:", error);
  process.exit(1);
});
