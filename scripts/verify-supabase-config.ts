#!/usr/bin/env bun

/**
 * Supabase Configuration Verification Script
 * 
 * This script helps diagnose Supabase configuration issues and tests connectivity
 * to ensure the middleware and authentication work properly.
 */

import { createClient } from '@supabase/supabase-js';

interface ConfigCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  value?: string;
}

function checkEnvironmentVariable(name: string, required: boolean = true): ConfigCheck {
  const value = process.env[name];
  
  if (!value) {
    return {
      name,
      status: required ? 'fail' : 'warning',
      message: required ? `Missing required environment variable: ${name}` : `Optional environment variable not set: ${name}`,
    };
  }
  
  // Mask sensitive values for display
  const displayValue = name.includes('KEY') || name.includes('SECRET') 
    ? `${value.substring(0, 8)}...${value.substring(value.length - 4)}`
    : value;
    
  return {
    name,
    status: 'pass',
    message: `Environment variable set correctly`,
    value: displayValue,
  };
}

function validateSupabaseUrl(url: string): ConfigCheck {
  try {
    const parsedUrl = new URL(url);
    
    if (parsedUrl.protocol !== 'https:') {
      return {
        name: 'URL Protocol',
        status: 'fail',
        message: 'Supabase URL must use HTTPS protocol',
        value: parsedUrl.protocol,
      };
    }
    
    if (!parsedUrl.hostname.includes('supabase.co')) {
      return {
        name: 'URL Domain',
        status: 'warning',
        message: 'URL does not appear to be a standard Supabase domain',
        value: parsedUrl.hostname,
      };
    }
    
    return {
      name: 'URL Format',
      status: 'pass',
      message: 'URL format is valid',
      value: `${parsedUrl.hostname}`,
    };
  } catch (error) {
    return {
      name: 'URL Format',
      status: 'fail',
      message: `Invalid URL format: ${error instanceof Error ? error.message : 'Unknown error'}`,
      value: url,
    };
  }
}

async function testSupabaseConnectivity(url: string, anonKey: string): Promise<ConfigCheck[]> {
  const checks: ConfigCheck[] = [];
  
  try {
    console.log('Creating Supabase client...');
    const supabase = createClient(url, anonKey);
    
    checks.push({
      name: 'Client Creation',
      status: 'pass',
      message: 'Supabase client created successfully',
    });
    
    // Test basic connectivity with a simple query
    console.log('Testing connectivity...');
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      checks.push({
        name: 'Connectivity Test',
        status: 'fail',
        message: `Connection failed: ${error.message}`,
      });
    } else {
      checks.push({
        name: 'Connectivity Test',
        status: 'pass',
        message: 'Successfully connected to Supabase',
      });
    }
    
    // Test if we can reach the auth endpoint
    try {
      const response = await fetch(`${url}/auth/v1/health`);
      if (response.ok) {
        checks.push({
          name: 'Auth Service Health',
          status: 'pass',
          message: 'Auth service is responding',
        });
      } else {
        checks.push({
          name: 'Auth Service Health',
          status: 'warning',
          message: `Auth service returned ${response.status}`,
        });
      }
    } catch (fetchError) {
      checks.push({
        name: 'Auth Service Health',
        status: 'fail',
        message: `Cannot reach auth service: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`,
      });
    }
    
  } catch (error) {
    checks.push({
      name: 'Client Creation',
      status: 'fail',
      message: `Failed to create Supabase client: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
  
  return checks;
}

function printResults(checks: ConfigCheck[]) {
  console.log('\n📋 Configuration Check Results:\n');
  
  const statusSymbols = {
    pass: '✅',
    fail: '❌',
    warning: '⚠️',
  };
  
  for (const check of checks) {
    const symbol = statusSymbols[check.status];
    console.log(`${symbol} ${check.name}`);
    console.log(`   ${check.message}`);
    if (check.value) {
      console.log(`   Value: ${check.value}`);
    }
    console.log('');
  }
}

function printSummary(checks: ConfigCheck[]) {
  const passed = checks.filter(c => c.status === 'pass').length;
  const failed = checks.filter(c => c.status === 'fail').length;
  const warnings = checks.filter(c => c.status === 'warning').length;
  
  console.log('\n📊 Summary:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   ⚠️  Warnings: ${warnings}`);
  
  if (failed > 0) {
    console.log('\n🚨 Action Required:');
    console.log('   Please fix the failed checks above before proceeding.');
    console.log('   The middleware will be skipped until all required environment variables are set.');
  } else if (warnings > 0) {
    console.log('\n⚠️  Recommendations:');
    console.log('   Consider addressing the warnings above for optimal functionality.');
  } else {
    console.log('\n🎉 All checks passed! Your Supabase configuration should work correctly.');
  }
}

async function main() {
  console.log('🔍 Verifying Supabase Configuration...\n');
  
  const checks: ConfigCheck[] = [];
  
  // Check environment variables
  checks.push(checkEnvironmentVariable('NEXT_PUBLIC_SUPABASE_URL', true));
  checks.push(checkEnvironmentVariable('NEXT_PUBLIC_SUPABASE_ANON_KEY', true));
  checks.push(checkEnvironmentVariable('SUPABASE_SERVICE_ROLE_KEY', false));
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  // Validate URL format if present
  if (supabaseUrl) {
    checks.push(validateSupabaseUrl(supabaseUrl));
  }
  
  // Test connectivity if we have the required variables
  if (supabaseUrl && supabaseAnonKey) {
    const connectivityChecks = await testSupabaseConnectivity(supabaseUrl, supabaseAnonKey);
    checks.push(...connectivityChecks);
  }
  
  printResults(checks);
  printSummary(checks);
  
  // Exit with error code if any critical checks failed
  const hasCriticalFailures = checks.some(c => c.status === 'fail' && c.name !== 'Auth Service Health');
  process.exit(hasCriticalFailures ? 1 : 0);
}

if (import.meta.main) {
  main().catch(console.error);
} 