import './style.css'
import MorseAdaptiveListener from 'morse-pro/lib/morse-pro-listener-adaptive'
import MorseAdaptiveDecoder from 'morse-pro/lib/morse-pro-decoder-adaptive'
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

        // Create decoder with adaptive speed detection
        this.decoder = new MorseAdaptiveDecoder({
            dictionary: 'international',
            dictionaryOptions: ['prosigns'],
            wpm: 20, // Initial speed estimate
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

        // Create audio player
        this.player = new MorsePlayerWAA({
            defaultFrequency: 563,
            volume: 0.5,
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

            // Create adaptive listener with parameters matching the working demo site
            this.listener = new MorseAdaptiveListener(
                2048,          // fftSize
                -60,           // volumeMin (demo site uses -60, not -100)
                -30,           // volumeMax (-30 dB, which is the maximum allowed)
                300,           // frequencyMin (Hz)
                1500,          // frequencyMax (Hz)
                200,           // volumeThreshold (demo site uses 200, not 50)
                this.decoder,  // decoder
                500,           // bufferDuration for frequency adaptation
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

            if (typeof this.listener.startListening === 'function') {
                console.log('Starting microphone via startListening method from parent class');
                this.listener.startListening();
            } else {
                console.log('startListening method not found, trying manual approach');
                // Force microphone access using navigator.mediaDevices
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    console.log('Microphone access granted manually');

                    // Manually update UI since the callback might not fire
                    document.getElementById('status').textContent = 'Listening for Morse code...';
                    document.getElementById('startStopBtn').textContent = 'Stop Listening';
                    document.getElementById('startStopBtn').disabled = false;
                    this.isListening = true;

                    // Connect the stream to the listener's audio processing
                    if (this.listener.audioContext && this.listener.audioContext.createMediaStreamSource) {
                        this.listener.sourceNode = this.listener.audioContext.createMediaStreamSource(stream);
                        if (this.listener.jsNode) {
                            this.listener.sourceNode.connect(this.listener.jsNode);
                        }
                    }
                } catch (micError) {
                    console.error('Manual microphone access failed:', micError);
                    document.getElementById('status').textContent = 'Microphone access denied';
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