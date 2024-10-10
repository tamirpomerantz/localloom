// TODO: loading state while recording


// Grabbing DOM elements for buttons, video, and timer
const closeBtn = document.getElementById('closeBtn');
const timerDisplay = document.getElementById('timer');
const webcamVideo = document.getElementById('webcam');
const audioButton = document.getElementById('audioButton');
const audioMenu = document.getElementById('audioMenu');

// Variables for recording and audio visualization
let mediaRecorder;
let recordedChunks = [];
let startTime, timerInterval, audioContext, analyzerNode, microphoneStream, audioStream;

// Function to initialize the audio context and create a sound level visualization
async function initAudio() {
  audioStream = await getAudioStream(); // Get the audio stream

  // Set up audio context and analyzer node for visualizing the audio input
  audioContext = new AudioContext();
  microphoneStream = audioContext.createMediaStreamSource(audioStream);
  analyzerNode = audioContext.createAnalyser();
  microphoneStream.connect(analyzerNode);
  analyzerNode.fftSize = 256; // Set the FFT size for analyzing frequency data
  const bufferLength = analyzerNode.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  // Get the SVG elements for the sound waves
  const l1 = document.getElementById('l1');
  const l2 = document.getElementById('l2');

  // Function to update the opacity of the sound waves based on sound level
  function updateSoundLevel() {
    analyzerNode.getByteFrequencyData(dataArray);
    const sum = dataArray.reduce((acc, value) => acc + value, 0);
    const average = sum / bufferLength;
    const normalizedLevel = average / 255; // Normalize the level between 0 and 1

    if (normalizedLevel <= 0.5) {
      l1.style.opacity = normalizedLevel * 2; // Scale opacity from 0 to 1
      l2.style.opacity = 0;
    } else {
      l1.style.opacity = 1;
      l2.style.opacity = (normalizedLevel - 0.5) * 2; // Scale opacity from 0 to 1
    }

    requestAnimationFrame(updateSoundLevel); // Keep updating sound level
  }

  updateSoundLevel(); // Start visualizing the sound level
}

// Function to get available audio input devices and populate the audio source menu
async function getAudioSources() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const audioSources = devices.filter(device => device.kind === 'audioinput');

  // Populate the audio menu with available audio sources
  audioMenu.innerHTML = audioSources.map(source => {
    const isSelected = source.deviceId === audioSourceSelect.value;
    return `
      <div class="audio-source" data-device-id="${source.deviceId}">
        ${isSelected ? '✓ ' : ''}${source.label || 'Microphone ' + source.deviceId}
      </div>
    `;
  }).join('');

  // Populate the audioSourceSelect dropdown
  audioSourceSelect.innerHTML = audioSources.map(source => `
    <option value="${source.deviceId}">
      ${source.label || 'Microphone ' + source.deviceId}
    </option>
  `).join('');

  // Add click event listeners to each audio source item
  audioMenu.querySelectorAll('.audio-source').forEach(item => {
    item.addEventListener('click', () => {
      const deviceId = item.dataset.deviceId;
      audioSourceSelect.value = deviceId;
      updateAudioSource(deviceId);
      audioMenu.style.display = 'none';
    });
  });
}

// Function to update the audio source
function updateAudioSource(deviceId) {
  // Update the audio stream with the new device
  // if (audioStream) {
  //   audioStream.getTracks().forEach(track => track.stop());
  // }
  // getAudioStream().then(newStream => {
  //   audioStream = newStream;
  //   // If you need to update any other parts of your app with the new audio stream, do it here
  // });

  // Update the checkmarks in the menu
  audioMenu.querySelectorAll('.audio-source').forEach(item => {
    if (item.dataset.deviceId === deviceId) {
      item.textContent = '✓ ' + item.textContent.replace('✓ ', '');
    } else {
      item.textContent = item.textContent.replace('✓ ', '');
    }
  });
}

// Toggle the audio source menu's visibility when the audio button is clicked
audioButton.addEventListener('click', (event) => {
  event.stopPropagation();
  audioMenu.style.display = (audioMenu.style.display === '' || audioMenu.style.display === 'none') ? 'block' : 'none';
});

// Close the audio menu when clicking outside of it
document.addEventListener('click', (event) => {
  if (audioMenu.style.display === 'block' && !audioMenu.contains(event.target) && event.target !== audioButton) {
    audioMenu.style.display = 'none';
  }
});

// Prevent clicks inside the audio menu from closing it
audioMenu.addEventListener('click', (event) => {
  event.stopPropagation();
});

// Function to capture the screen stream for recording
async function getScreenStream() {
  const sources = await window.electronAPI.getDesktopSources({ types: ['screen'] });
  const matchingDisplay = await window.electronAPI.getMatchingScreen(); // Get the display containing the Electron window

  // Find the correct screen source based on the matching display
  const screenSource = sources.find(source => String(source.display_id) === String(matchingDisplay.id)) || sources[0];

  // Capture the screen stream
  const screenStream = await navigator.mediaDevices.getUserMedia({
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: screenSource.id,
        maxWidth: window.screen.width,
        maxHeight: window.screen.height
      }
    }
  });

  return screenStream;
}

// Function to get the webcam stream
async function getWebcamStream() {
  const webcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  webcamVideo.srcObject = webcamStream; // Display webcam stream in the video element
  
  // Add event listener to add .no-bg class after stream has loaded
  webcamVideo.addEventListener('loadedmetadata', () => {
    document.body.classList.add('no-bg');
  });

  return webcamStream;
}

// Function to get the audio stream based on the selected device
async function getAudioStream() {
  const selectedAudioDeviceId = audioSourceSelect.value;
  const audioStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: selectedAudioDeviceId ? { exact: selectedAudioDeviceId } : undefined
    }
  });
  return audioStream;
}

// Function to start recording the screen and audio streams
async function startRecording() {
  const screenStream = await getScreenStream();
  const audioStream = await getAudioStream();

  // Create a canvas to resize the video
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Set the canvas size to 960px width and maintain aspect ratio
  const videoWidth = 960;
  const screenVideoTrack = screenStream.getVideoTracks()[0];
  const videoSettings = screenVideoTrack.getSettings();
  const videoHeight = (videoSettings.height / videoSettings.width) * videoWidth;

  canvas.width = videoWidth;
  canvas.height = videoHeight;

  // Create a video element to play the screen stream on the canvas
  const screenVideo = document.createElement('video');
  screenVideo.srcObject = screenStream;
  screenVideo.muted = true; // Mute the video to avoid feedback
  await screenVideo.play();

  // Function to draw the video frames onto the canvas
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height); // Draw the screen video
    requestAnimationFrame(draw); // Continuously draw the video frames
  }

  draw(); // Start drawing the video

  // Capture the canvas as a video stream and add the audio stream
  const outputStream = canvas.captureStream();
  audioStream.getTracks().forEach(track => outputStream.addTrack(track));

  // Initialize the media recorder with the combined streams
  mediaRecorder = new MediaRecorder(outputStream, { mimeType: 'video/webm;codecs=vp9' });
  mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
  mediaRecorder.onstop = saveVideo;

  mediaRecorder.start(); // Start recording

  // Reset and start the timer
  timerDisplay.textContent = "00:00";
  timerDisplay.style.display = 'inline-block';
  startTime = Date.now();
  timerInterval = setInterval(updateTimer, 1000);

}

// Function to stop the recording
function stopRecording() {
  mediaRecorder.stop();
  clearInterval(timerInterval);


  timerDisplay.style.display = 'none';
}

// Function to save the recorded video and send it to the main process for conversion
async function saveVideo() {
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const buffer = await blob.arrayBuffer();
  
  // Show loader and hide buttons
  document.querySelector('.loader-fullscreen').classList.add('visible');

  
  try {
    const resultPath = await window.electronAPI.convertVideo(buffer);
    console.log('Conversion completed. Output saved at:', resultPath);

    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = resultPath;
    a.download = 'converted_recording.mp4';
    document.body.appendChild(a);
    a.click();
  } catch (error) {
    console.error('Error during video conversion:', error);
  } finally {
    // Hide loader and show start button
    document.querySelector('.loader-fullscreen').classList.remove('visible');
  }

  recordedChunks = [];
}

// Function to update the recording timer display
function updateTimer() {
  const elapsed = Date.now() - startTime;
  const minutes = Math.floor(elapsed / 60000).toString().padStart(2, '0');
  const seconds = Math.floor((elapsed % 60000) / 1000).toString().padStart(2, '0');
  timerDisplay.textContent = `${minutes}:${seconds}`;
}

// Close button functionality: stops recording if active and closes the app
closeBtn.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    stopRecording();  // Stop recording if active
  }
  window.close();  // Close the app window
});

// Initialize the app by setting up webcam, audio sources, and sound visualization
getWebcamStream();
getAudioSources();  // Populate the audio sources menu
initAudio();  // Start sound level animation

// Replace the separate event listeners with a single one
const recordBtn = document.getElementById('startBtn'); // We'll keep using 'startBtn' as the ID
recordBtn.addEventListener('click', toggleRecording);


let isRecording = false; // New variable to track recording state

function toggleRecording() {
    if (isRecording) {
        stopRecording();
        updateRecordButton("start");
        isRecording = false;
    } else {
        startRecording();
        updateRecordButton("stop");
        isRecording = true;
    }
}

function updateRecordButton(state) {
    const startBtn = document.getElementById('startBtn');
    const label = startBtn.querySelector('.label');

    if (state === "stop") {
      startBtn.classList.add('stop');
        label.textContent = "Stop Recording";
    } else {
      startBtn.classList.remove('stop');
        label.textContent = "Start Recording";
    }
}