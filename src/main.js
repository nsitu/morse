import './style.css'
import MorseListener from 'morse-pro/lib/morse-pro-listener'
import MorseDecoder from 'morse-pro/lib/morse-pro-decoder'
import MorsePlayerWAA from 'morse-pro/lib/morse-pro-player-waa'
import MorseCW from 'morse-pro/lib/morse-pro-cw'

class MorseCodeDecoder {
    constructor() {
        this.listener = null;
        this.decoder = null;
        this.player = null;
        this.morseCW = null;
        this.isListening = false;
        this.decodedText = '';
        this.currentMode = 'receive'; // 'receive' or 'send'
        this.preparedTimings = null; // Store pre-generated morse timing data

        this.initializeUI();
        this.setupDecoder();
        this.setupGenerator();
    }

    initializeUI() {
        document.querySelector('#app').innerHTML = `
      <div class="morse-app">
        <h1>Morse Code Transceiver</h1>
        <p>Decode incoming Morse code or generate Morse code from text.</p>
        
        <!-- Tab Navigation -->
        <div class="tab-container">
          <button id="receiveTab" class="tab-btn active" data-mode="receive">📻 Receive</button>
          <button id="sendTab" class="tab-btn" data-mode="send">📡 Send</button>
        </div>

        <!-- Receive Mode -->
        <div id="receiveMode" class="mode-panel active">
          <h2>Decode Morse Code</h2>
          <p>Listen for Morse code via your microphone and see it decoded in real-time.</p>
          
          <div class="controls">
            <button id="startStopBtn" class="btn">Start Listening</button>
            <button id="clearReceiveBtn" class="btn secondary">Clear Text</button>
          </div>
          
          <div class="status">
            <div id="status">Ready to listen</div>
            <div id="speed">Speed: -- WPM</div>
          </div>
          
          <div class="output">
            <h3>Decoded Text:</h3>
            <div id="decodedText" class="decoded-text"></div>
          </div>
          
          <div class="morse-output">
            <h3>Morse Code:</h3>
            <div id="morseCode" class="morse-code"></div>
          </div>
        </div>

        <!-- Send Mode -->
        <div id="sendMode" class="mode-panel">
          <h2>Generate Morse Code</h2>
          <p>Type text and convert it to Morse code audio.</p>
          
          <div class="input-section">
            <label for="textInput">Enter text to convert:</label>
            <textarea id="textInput" class="text-input" placeholder="Type your message here..." rows="3"></textarea>
          </div>

          <div class="controls">
            <button id="sendBtn" class="btn primary">📡 Send Morse Code</button>
            <button id="stopBtn" class="btn secondary" disabled>⏹️ Stop</button>
            <button id="clearSendBtn" class="btn secondary">Clear</button>
          </div>
          
          <div class="output">
            <h3>Generated Morse Code:</h3>
            <div id="generatedMorse" class="morse-code"></div>
          </div>
        </div>
        
        <!-- Footer -->
        <footer class="app-footer">
          <p>Powered by <a href="https://www.npmjs.com/package/morse-pro" target="_blank" rel="noopener noreferrer">morse-pro</a></p>
        </footer>
      </div>
    `;

        this.bindEventListeners();
    }

    bindEventListeners() {
        // Tab switching
        document.getElementById('receiveTab').addEventListener('click', () => {
            this.switchMode('receive');
        });

        document.getElementById('sendTab').addEventListener('click', () => {
            this.switchMode('send');
        });

        // Receive mode controls
        document.getElementById('startStopBtn').addEventListener('click', () => {
            this.toggleListening();
        });

        document.getElementById('clearReceiveBtn').addEventListener('click', () => {
            this.clearReceiveOutput();
        });

        // Send mode controls
        document.getElementById('sendBtn').addEventListener('click', () => {
            this.sendMorseCode();
        });

        document.getElementById('stopBtn').addEventListener('click', () => {
            this.stopPlayback();
        });

        document.getElementById('clearSendBtn').addEventListener('click', () => {
            this.clearSendOutput();
        });

        // Auto-generate morse code as user types
        document.getElementById('textInput').addEventListener('input', () => {
            this.generateMorseCode();
        });
    }

    switchMode(mode) {
        // Update current mode
        this.currentMode = mode;

        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(mode + 'Tab').classList.add('active');

        // Update panels
        document.querySelectorAll('.mode-panel').forEach(panel => panel.classList.remove('active'));
        document.getElementById(mode + 'Mode').classList.add('active');

        // Stop listening if switching away from receive mode
        if (mode !== 'receive' && this.isListening) {
            this.stopListening();
        }
    }

    setupDecoder() {
        // Message callback - called when morse is decoded
        const messageCallback = (data) => {
            console.log('Decoded:', data);

            // Append to decoded text
            this.decodedText += data.message;
            document.getElementById('decodedText').textContent = this.decodedText;

            // Show morse code
            const morseElement = document.getElementById('morseCode');
            morseElement.textContent += data.morse + ' ';

            // Auto-scroll to bottom
            morseElement.scrollTop = morseElement.scrollHeight;
            document.getElementById('decodedText').scrollTop = document.getElementById('decodedText').scrollHeight;
        };

        // Speed callback - called when speed changes
        const speedCallback = (speedData) => {
            document.getElementById('speed').textContent = `Speed: ${Math.round(speedData.wpm)} WPM`;
        };

        // Create decoder with fixed optimal speed for consistent performance
        this.decoder = new MorseDecoder({
            dictionary: 'international',
            dictionaryOptions: ['prosigns'],
            wpm: 20, // Fixed speed matching our transmission
            messageCallback,
            speedCallback
        });
    }

    setupGenerator() {
        // Create Morse CW generator
        this.morseCW = new MorseCW({
            dictionary: 'international',
            dictionaryOptions: ['prosigns'],
            wpm: 20,
            fwpm: 20
        });

        // Create audio player with higher volume for better reliability
        this.player = new MorsePlayerWAA({
            defaultFrequency: 563,
            volume: 0.99, // Increased from 0.5 to 0.99 for better detection reliability
            sequenceEndCallback: () => {
                // Re-enable send button when playback ends
                document.getElementById('sendBtn').disabled = false;
                document.getElementById('stopBtn').disabled = true;
            }
        });
    }

    async toggleListening() {
        if (!this.isListening) {
            await this.startListening();
        } else {
            this.stopListening();
        }
    }

    async startListening() {
        try {
            // Update UI
            document.getElementById('status').textContent = 'Requesting microphone access...';
            document.getElementById('startStopBtn').textContent = 'Starting...';
            document.getElementById('startStopBtn').disabled = true;

            // Create fixed listener with optimal parameters for 563Hz transmission
            this.listener = new MorseListener(
                2048,          // fftSize
                -70,           // volumeMin
                -30,           // volumeMax
                538,           // frequencyMin (563Hz - 25Hz tolerance)
                588,           // frequencyMax (563Hz + 25Hz tolerance)
                120,           // volumeThreshold
                this.decoder,  // decoder
                () => { },      // spectrogramCallback - empty function
                () => { },      // frequencyFilterCallback - empty function  
                () => { },      // volumeFilterCallback - empty function
                () => { },      // volumeThresholdCallback - empty function
                () => {        // micSuccessCallback
                    console.log('Microphone access granted - updating UI');
                    document.getElementById('status').textContent = 'Listening for Morse code...';
                    document.getElementById('startStopBtn').textContent = 'Stop Listening';
                    document.getElementById('startStopBtn').disabled = false;
                    this.isListening = true;
                },
                (error) => {   // micErrorCallback
                    console.error('Microphone error:', error);
                    document.getElementById('status').textContent = 'Microphone access denied or error occurred';
                    document.getElementById('startStopBtn').textContent = 'Start Listening';
                    document.getElementById('startStopBtn').disabled = false;
                    alert('Could not access microphone. Please ensure you have granted microphone permissions.');
                },
                () => { },     // fileLoadCallback - empty function
                () => { },     // fileErrorCallback - empty function  
                () => { }      // EOFCallback - empty function
            );

            // Check if listener was created successfully
            console.log('Listener created:', this.listener);
            console.log('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(this.listener)));

            // Use the startListening method from the parent MorseListener class
            const parentMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(Object.getPrototypeOf(this.listener)));
            console.log('Parent class methods:', parentMethods);

            // Always use manual approach with optimal audio constraints to prevent mobile filtering
            try {
                document.getElementById('status').textContent = 'Requesting raw audio access...';
                console.log('Requesting microphone with raw audio constraints to prevent mobile filtering');

                // Advanced audio constraints to disable mobile audio processing
                const audioConstraints = {
                    audio: {
                        // Disable automatic gain control
                        autoGainControl: false,
                        // Disable noise suppression (key for morse code!)
                        noiseSuppression: false,
                        // Disable echo cancellation
                        echoCancellation: false,
                        // Request high sample rate for better frequency resolution
                        sampleRate: { ideal: 48000 },
                        // Request sufficient channel count
                        channelCount: { ideal: 1 },
                        // Request low latency for real-time processing
                        latency: { ideal: 0.01 },
                        // Request high sample size for better dynamic range
                        sampleSize: { ideal: 16 }
                    },
                    video: false
                };

                const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
                const audioTrack = stream.getAudioTracks()[0];
                const settings = audioTrack.getSettings();

                console.log('Microphone access granted with raw audio settings');
                console.log('Audio track settings:', settings);

                // Show detailed status in UI for mobile debugging
                const statusParts = [
                    'Raw Audio Mode ✓',
                    `AGC: ${settings.autoGainControl === false ? 'OFF' : 'ON'}`,
                    `Noise: ${settings.noiseSuppression === false ? 'OFF' : 'ON'}`,
                    `Echo: ${settings.echoCancellation === false ? 'OFF' : 'ON'}`,
                    `${Math.round(settings.sampleRate / 1000)}kHz`
                ];
                document.getElementById('status').textContent = statusParts.join(' | ');

                document.getElementById('startStopBtn').textContent = 'Stop Listening';
                document.getElementById('startStopBtn').disabled = false;
                this.isListening = true;

                // Connect the stream to the listener's audio processing
                if (this.listener.audioContext && this.listener.audioContext.createMediaStreamSource) {
                    this.listener.sourceNode = this.listener.audioContext.createMediaStreamSource(stream);
                    if (this.listener.jsNode) {
                        this.listener.sourceNode.connect(this.listener.analyserNode);
                        this.listener.jsNode.connect(this.listener.audioContext.destination);
                    }
                }
            } catch (micError) {
                console.error('Raw audio access failed, trying with basic constraints:', micError);
                document.getElementById('status').textContent = 'Raw audio failed, trying basic...';

                // Fallback to basic constraints if advanced ones fail
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    const audioTrack = stream.getAudioTracks()[0];
                    const settings = audioTrack.getSettings();

                    console.log('Microphone access granted with basic settings');

                    // Show basic mode status in UI
                    const statusParts = [
                        'Basic Audio Mode',
                        `AGC: ${settings.autoGainControl === false ? 'OFF' : 'ON'}`,
                        `Noise: ${settings.noiseSuppression === false ? 'OFF' : 'ON'}`,
                        `${Math.round(settings.sampleRate / 1000)}kHz`
                    ];
                    document.getElementById('status').textContent = statusParts.join(' | ');

                    document.getElementById('startStopBtn').textContent = 'Stop Listening';
                    document.getElementById('startStopBtn').disabled = false;
                    this.isListening = true;

                    // Connect the stream to the listener's audio processing
                    if (this.listener.audioContext && this.listener.audioContext.createMediaStreamSource) {
                        this.listener.sourceNode = this.listener.audioContext.createMediaStreamSource(stream);
                        if (this.listener.jsNode) {
                            this.listener.sourceNode.connect(this.listener.analyserNode);
                            this.listener.jsNode.connect(this.listener.audioContext.destination);
                        }
                    }
                } catch (basicError) {
                    console.error('All microphone access attempts failed:', basicError);
                    document.getElementById('status').textContent = `Microphone access failed: ${basicError.message}`;
                    document.getElementById('startStopBtn').textContent = 'Start Listening';
                    document.getElementById('startStopBtn').disabled = false;
                }
            }
        } catch (error) {
            console.error('Error starting listener:', error);
            document.getElementById('status').textContent = 'Error starting listener: ' + error.message;
            document.getElementById('startStopBtn').textContent = 'Start Listening';
            document.getElementById('startStopBtn').disabled = false;
        }
    }

    stopListening() {
        if (this.listener) {
            this.listener.stop();
            this.listener = null;
        }

        // Flush any remaining data in decoder
        if (this.decoder) {
            this.decoder.flush();
        }

        this.isListening = false;
        document.getElementById('status').textContent = 'Stopped listening';
        document.getElementById('startStopBtn').textContent = 'Start Listening';
        document.getElementById('startStopBtn').disabled = false;
        document.getElementById('speed').textContent = 'Speed: -- WPM';
    }

    generateMorseCode() {
        const text = document.getElementById('textInput').value.trim();

        // Clear display if no text
        if (!text) {
            document.getElementById('generatedMorse').textContent = '';
            this.preparedTimings = null;
            document.getElementById('sendBtn').disabled = true;
            return;
        }

        try {
            // Update player settings with optimal values
            const wpm = 20; // Fixed optimal speed for accuracy
            const frequency = 563; // Fixed optimal frequency

            this.morseCW.setWPM(wpm);
            this.player.frequency = frequency;

            // Tokenize the text
            const tokens = this.morseCW.tokeniseText(text);

            // Convert text tokens to morse tokens in the format expected by morseTokens2timing
            const morseTokens = [];
            const morseCodeDisplay = [];

            tokens.forEach(tokenArray => {
                const wordTokens = [];
                const wordMorseDisplay = [];

                tokenArray.forEach(token => {
                    // Look up the token in the text2morse dictionary
                    const morseCode = this.morseCW.text2morseD[token.toUpperCase()];
                    if (morseCode) {
                        wordTokens.push(morseCode);
                        // Remove any internal spaces from morse code letters to match receiver format
                        wordMorseDisplay.push(morseCode.replace(/\s+/g, ''));
                    } else {
                        console.warn('Unknown character:', token);
                    }
                });

                // Add the word tokens and display if we have any
                if (wordTokens.length > 0) {
                    morseTokens.push(wordTokens);
                    // Join letters in the word with spaces, matching receiver format
                    morseCodeDisplay.push(wordMorseDisplay.join('  '));
                }
            });

            // Display the morse code with word separators, matching receiver format
            document.getElementById('generatedMorse').textContent = morseCodeDisplay.join('/ ');

            try {
                // Generate timing for playback and store it
                this.preparedTimings = this.morseCW.morseTokens2timing(morseTokens);

                // Enable send button since we have valid morse code
                document.getElementById('sendBtn').disabled = false;

            } catch (timingError) {
                console.error('Error generating timing:', timingError);
                this.preparedTimings = null;
                document.getElementById('sendBtn').disabled = true;
            }

        } catch (error) {
            console.error('Error generating morse code:', error);
            document.getElementById('generatedMorse').textContent = 'Error generating morse code';
            this.preparedTimings = null;
            document.getElementById('sendBtn').disabled = true;
        }
    }

    sendMorseCode() {
        // Check if we have prepared timings ready to play
        if (!this.preparedTimings) {
            alert('No morse code ready to send. Please enter some text first.');
            return;
        }

        try {
            // Load the pre-generated sequence for playback
            this.player.load({ timings: this.preparedTimings });

            // Start playing immediately
            this.player.playFromStart();
            document.getElementById('sendBtn').disabled = true;
            document.getElementById('stopBtn').disabled = false;

        } catch (error) {
            console.error('Error playing morse code:', error);
            alert('Error playing morse code: ' + error.message);
        }
    }

    playMorseCode() {
        if (this.player) {
            this.player.playFromStart();
            document.getElementById('playBtn').disabled = true;
            document.getElementById('stopBtn').disabled = false;
        }
    }

    stopPlayback() {
        if (this.player) {
            this.player.stop();
            document.getElementById('sendBtn').disabled = false;
            document.getElementById('stopBtn').disabled = true;
        }
    }

    clearSendOutput() {
        document.getElementById('textInput').value = '';
        document.getElementById('generatedMorse').textContent = '';
        this.preparedTimings = null;
        document.getElementById('sendBtn').disabled = true;
        document.getElementById('stopBtn').disabled = true;
    }

    clearReceiveOutput() {
        this.decodedText = '';
        document.getElementById('decodedText').textContent = '';
        document.getElementById('morseCode').textContent = '';
    }

    clearOutput() {
        this.decodedText = '';
        document.getElementById('decodedText').textContent = '';
        document.getElementById('morseCode').textContent = '';
    }
}

// Initialize the application
new MorseCodeDecoder();