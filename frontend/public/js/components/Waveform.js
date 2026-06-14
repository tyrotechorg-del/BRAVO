

class WaveformVisualizer {
    constructor(containerId, audioElement) {
        this.container = typeof containerId === 'string'
            ? document.querySelector(containerId)
            : containerId;
        this.audio = audioElement;
        this.canvas = null;
        this.ctx = null;
        this.animationId = null;
        this.isActive = false;

        // Web Audio nodes
        this.audioContext = null;
        this.analyser = null;
        this.source = null;
        this.dataArray = null;

        // Whether we successfully wired the analyser. If not, we
        // fall back to the static placeholder.
        this._analyserReady = false;

        this.init();
    }

    init() {
        if (!this.container) return;

        this.canvas = document.createElement('canvas');
        this.canvas.width = this.container.clientWidth || 600;
        this.canvas.height = 80;
        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);

        this._setupAudioAnalyser();
        this._setupEventListeners();
        this._drawPlaceholder();
    }

    
    _setupAudioAnalyser() {
        if (!this.audio || !window.AudioContext) {
            return; // no Web Audio support
        }

        try {
            // Cache the source on the audio element to satisfy the
            // "createMediaElementSource can only be called once per
            // element" rule.
            let source = this.audio.__bravoAudioSource;
            let context = this.audio.__bravoAudioContext;

            if (!source) {
                context = new AudioContext();
                source = context.createMediaElementSource(this.audio);
                // Connect source to destination so audio still plays.
                source.connect(context.destination);
                this.audio.__bravoAudioSource = source;
                this.audio.__bravoAudioContext = context;
                // Ensure crossOrigin is set so the source isn't tainted.
                // It must be set BEFORE the audio.src is set; this is
                // best-effort here (works for subsequent loads).
                if (!this.audio.crossOrigin) {
                    try { this.audio.crossOrigin = 'anonymous'; } catch {}
                }
            }

            this.audioContext = context;
            this.source = source;

            this.analyser = context.createAnalyser();
            this.analyser.fftSize = 256; // 128 frequency bins
            this.analyser.smoothingTimeConstant = 0.8;

            // Source → analyser (analyser is a tap — we already connected
            // source → destination above, so audio output is preserved).
            this.source.connect(this.analyser);

            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);

            this._analyserReady = true;
        } catch (err) {
            console.info('Waveform analyser not available (likely CORS):', err.message);
            this._analyserReady = false;
        }
    }

    _setupEventListeners() {
        // Recompute canvas width on resize (with light debouncing —
        // not strictly needed but avoids thrashing on rapid resizes).
        this._resizeTimer = null;
        this._onResize = () => {
            clearTimeout(this._resizeTimer);
            this._resizeTimer = setTimeout(() => {
                if (this.canvas && this.container) {
                    this.canvas.width = this.container.clientWidth || 600;
                    if (!this.isActive) this._drawPlaceholder();
                }
            }, 100);
        };
        window.addEventListener('resize', this._onResize);

        if (this.audio) {
            this._onPlay = () => this._startVisualization();
            this._onPause = () => this._stopVisualization();
            this._onEnded = () => this._stopVisualization();
            this.audio.addEventListener('play', this._onPlay);
            this.audio.addEventListener('pause', this._onPause);
            this.audio.addEventListener('ended', this._onEnded);
        }
    }

    _startVisualization() {
        if (this.isActive) return;
        this.isActive = true;

        // Some browsers (Safari) start the AudioContext in 'suspended'
        // state until the first user gesture. Resume it on play.
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(() => {});
        }

        this._visualize();
    }

    _stopVisualization() {
        this.isActive = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this._drawPlaceholder();
    }

    _visualize() {
        if (!this.isActive) return;

        this.animationId = requestAnimationFrame(() => this._visualize());

        if (this._analyserReady && this.analyser && this.dataArray) {
            this._drawFromAnalyser();
        } else {
            // Fall back to a static-but-progress-tracking display.
            // Still better than the old code's fake sine: at least
            // the progress line is real.
            this._drawProgressOnly();
        }
    }

    _drawFromAnalyser() {
        this.analyser.getByteFrequencyData(this.dataArray);

        const W = this.canvas.width;
        const H = this.canvas.height;
        const binCount = this.dataArray.length;

        // Background
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, W, H);

        const numBars = 100;
        const step = W / numBars;
        // Map each bar to a bin (or average of bins).
        const binsPerBar = Math.max(1, Math.floor(binCount / numBars));

        // Compute progress for color split
        const progress = (this.audio.duration > 0)
            ? this.audio.currentTime / this.audio.duration
            : 0;

        for (let i = 0; i < numBars; i++) {
            // Average over `binsPerBar` bins to make bars smoother.
            let sum = 0;
            const start = i * binsPerBar;
            for (let j = 0; j < binsPerBar && start + j < binCount; j++) {
                sum += this.dataArray[start + j];
            }
            const value = sum / binsPerBar; // 0-255
            const height = Math.max(4, (value / 255) * (H - 8));

            const x = i * step;
            const y = (H - height) / 2;

            this.ctx.fillStyle = (i / numBars) < progress ? '#6c63ff' : '#3a3a3a';
            this.ctx.fillRect(x, y, Math.max(1, step - 2), height);
        }

        // Progress line
        const progressX = W * progress;
        this.ctx.beginPath();
        this.ctx.moveTo(progressX, 0);
        this.ctx.lineTo(progressX, H);
        this.ctx.strokeStyle = '#ff6584';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }

    /**
     * Fallback when the analyser isn't available. Shows a static
     * bar pattern with a real progress line. Honest about being
     * a placeholder (doesn't pretend to react to the music).
     */
    _drawProgressOnly() {
        const W = this.canvas.width;
        const H = this.canvas.height;

        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, W, H);

        const progress = (this.audio.duration > 0)
            ? this.audio.currentTime / this.audio.duration
            : 0;

        const numBars = 100;
        const step = W / numBars;
        for (let i = 0; i < numBars; i++) {
            // Deterministic pseudo-random heights based on position
            // (same shape every time — looks intentional, not janky).
            const height = ((Math.sin(i * 0.5) + 1.2) * (H / 4)) + 8;
            const x = i * step;
            const y = (H - height) / 2;
            this.ctx.fillStyle = (i / numBars) < progress ? '#6c63ff' : '#2a2a2a';
            this.ctx.fillRect(x, y, Math.max(1, step - 2), height);
        }

        const progressX = W * progress;
        this.ctx.beginPath();
        this.ctx.moveTo(progressX, 0);
        this.ctx.lineTo(progressX, H);
        this.ctx.strokeStyle = '#ff6584';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }

    _drawPlaceholder() {
        if (!this.ctx) return;
        const W = this.canvas.width;
        const H = this.canvas.height;

        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, W, H);

        const numBars = 100;
        const step = W / numBars;
        for (let i = 0; i < numBars; i++) {
            const height = ((Math.sin(i * 0.5) + 1.2) * (H / 4)) + 8;
            const x = i * step;
            const y = (H - height) / 2;
            this.ctx.fillStyle = '#2a2a2a';
            this.ctx.fillRect(x, y, Math.max(1, step - 2), height);
        }
    }

    destroy() {
        this._stopVisualization();
        window.removeEventListener('resize', this._onResize);
        if (this.audio) {
            this.audio.removeEventListener('play', this._onPlay);
            this.audio.removeEventListener('pause', this._onPause);
            this.audio.removeEventListener('ended', this._onEnded);
        }
        // Disconnect the analyser tap — but DON'T close the
        // AudioContext or disconnect the source-destination chain.
        // Those are shared with the audio element and other instances.
        if (this.analyser) {
            try { this.analyser.disconnect(); } catch {}
        }
        if (this.canvas && this.container?.contains(this.canvas)) {
            this.container.removeChild(this.canvas);
        }
    }
}

window.WaveformVisualizer = WaveformVisualizer;
