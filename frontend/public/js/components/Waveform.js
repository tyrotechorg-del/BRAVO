/**
 * Waveform Visualizer Component
 */

class WaveformVisualizer {
    constructor(containerId, audioElement) {
        this.container = document.querySelector(containerId);
        this.audio = audioElement;
        this.canvas = null;
        this.ctx = null;
        this.animationId = null;
        this.isActive = false;
        this.init();
    }
    
    init() {
        if (!this.container) return;
        
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.container.clientWidth;
        this.canvas.height = 80;
        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);
        
        this.setupEventListeners();
        this.drawStaticWaveform();
    }
    
    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.canvas.width = this.container.clientWidth;
            this.drawStaticWaveform();
        });
        
        if (this.audio) {
            this.audio.addEventListener('play', () => this.startVisualization());
            this.audio.addEventListener('pause', () => this.stopVisualization());
            this.audio.addEventListener('ended', () => this.stopVisualization());
        }
    }
    
    startVisualization() {
        if (this.isActive) return;
        this.isActive = true;
        this.visualize();
    }
    
    stopVisualization() {
        this.isActive = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.drawStaticWaveform();
    }
    
    visualize() {
        if (!this.isActive || !this.audio || !this.audio.currentTime) {
            this.drawStaticWaveform();
            return;
        }
        
        this.animationId = requestAnimationFrame(() => this.visualize());
        
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        const progress = this.audio.currentTime / this.audio.duration;
        const progressX = this.canvas.width * progress;
        
        const step = this.canvas.width / 100;
        for (let i = 0; i < 100; i++) {
            let height;
            if (i < progress * 100) {
                height = Math.sin(i * Math.PI / 50) * 25 + 35;
                this.ctx.fillStyle = '#6c63ff';
            } else {
                height = Math.sin(i * Math.PI / 50) * 15 + 25;
                this.ctx.fillStyle = '#2a2a2a';
            }
            const x = i * step;
            const y = (this.canvas.height - height) / 2;
            this.ctx.fillRect(x, y, step - 2, height);
        }
        
        this.ctx.beginPath();
        this.ctx.moveTo(progressX, 0);
        this.ctx.lineTo(progressX, this.canvas.height);
        this.ctx.strokeStyle = '#ff6584';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }
    
    drawStaticWaveform() {
        if (!this.ctx) return;
        
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        const step = this.canvas.width / 100;
        for (let i = 0; i < 100; i++) {
            const height = Math.sin(i * Math.PI / 50) * 20 + 30;
            const x = i * step;
            const y = (this.canvas.height - height) / 2;
            this.ctx.fillStyle = '#2a2a2a';
            this.ctx.fillRect(x, y, step - 2, height);
        }
    }
    
    destroy() {
        this.stopVisualization();
        if (this.container && this.canvas) {
            this.container.removeChild(this.canvas);
        }
    }
}

window.WaveformVisualizer = WaveformVisualizer;