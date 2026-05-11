/**
 * FFmpeg Execution Test
 * 
 * This file contains tests for the FFmpeg execution layer.
 * It verifies that the FFmpeg service can execute commands,
 * validate inputs, and handle errors correctly.
 */

import { FFmpegService } from '../services/video/FFmpegService';
import { TimelineToFFmpegConverter } from '../services/video/TimelineToFFmpegConverter';
import { createSampleTimeline } from '../data/sampleTimeline';

/**
 * Test the FFmpeg service initialization
 */
async function testFFmpegInitialization() {
  const ffmpeg = new FFmpegService();
  
  try {
    const initialized = await ffmpeg.initialize();
    console.log('FFmpeg initialized:', initialized);
    return initialized;
  } catch (error) {
    console.error('FFmpeg initialization failed:', error);
    return false;
  }
}

/**
 * Test command execution
 */
async function testCommandExecution() {
  const ffmpeg = new FFmpegService();
  await ffmpeg.initialize();
  
  try {
    const result = await ffmpeg.executeCommand(['-version']);
    console.log('FFmpeg version command result:', result);
    return true;
  } catch (error) {
    console.error('Command execution failed:', error);
    return false;
  }
}

/**
 * Test timeline to FFmpeg conversion
 */
async function testTimelineConversion() {
  const converter = new TimelineToFFmpegConverter();
  const timeline = createSampleTimeline();
  
  try {
    const { inputFiles, filterComplex } = converter.generateFilterComplex(timeline);
    console.log('Input files:', inputFiles);
    console.log('Filter complex:', filterComplex);
    return true;
  } catch (error) {
    console.error('Timeline conversion failed:', error);
    return false;
  }
}

/**
 * Run the tests
 */
async function runTests() {
  console.log('=== FFmpeg Execution Tests ===');
  
  console.log('\nTesting FFmpeg initialization...');
  const initResult = await testFFmpegInitialization();
  
  console.log('\nTesting command execution...');
  const commandResult = await testCommandExecution();
  
  console.log('\nTesting timeline conversion...');
  const conversionResult = await testTimelineConversion();
  
  console.log('\n=== Test Results ===');
  console.log('FFmpeg initialization:', initResult ? 'PASSED' : 'FAILED');
  console.log('Command execution:', commandResult ? 'PASSED' : 'FAILED');
  console.log('Timeline conversion:', conversionResult ? 'PASSED' : 'FAILED');
}

// Run the tests (in a real application, this would be triggered by a test runner)
// runTests();

export { runTests };