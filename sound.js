class AudioManager {
    constructor() {
        this.sounds = {};
        this.basePath = 'assets/sounds/';
        this.bgmKeys = new Set(['turn_p1', 'turn_p2']);
        this.bgmVolume = 0.6;
        this.soundFiles = {
            'select': 'select.mp3',
            'move_foot': 'move_foot.mp3',
            'move_tread': 'move_tread.mp3',
            'turn_p1': 'turn_p1.mp3',
            'turn_p2': 'turn_p2.mp3',
            'cancel': 'select.mp3',
            'unload': 'select.mp3',
            'attack_artillery': 'move_foot.mp3',
            'attack_shoot': 'move_foot.mp3'
        };
        this.loadAll();
    }

    loadAll() {
        Object.entries(this.soundFiles).forEach(([key, filename]) => {
            const audio = new Audio(this.basePath + filename);
            // Loop background music
            if (key === 'turn_p1' || key === 'turn_p2') {
                audio.loop = true;
            }
            audio.volume = this.bgmKeys.has(key) ? this.bgmVolume : 1;
            // Handle error gracefully (e.g. file is dummy or missing)
            audio.addEventListener('error', (e) => {
                // Silently ignore or log as warning
                // console.warn(`Sound file ${filename} not loaded or invalid.`);
            });
            this.sounds[key] = audio;
        });
    }

    setBgmVolume(volume) {
        const normalized = Math.max(0, Math.min(1, Number(volume)));
        this.bgmVolume = Number.isFinite(normalized) ? normalized : this.bgmVolume;
        this.bgmKeys.forEach(key => {
            if (this.sounds[key]) {
                this.sounds[key].volume = this.bgmVolume;
            }
        });
    }

    getBgmVolume() {
        return this.bgmVolume;
    }

    play(key) {
        const sound = this.sounds[key];
        if (sound) {
            try {
                // Reset to start if already playing
                sound.currentTime = 0;
                sound.play().catch(e => {
                    // Ignore errors from missing files or autoplay restrictions
                    // console.log(`Cannot play sound ${key}`);
                });
            } catch (e) {
                // Ignore sync errors
            }
        }
    }

    stop(key) {
        const sound = this.sounds[key];
        if (sound) {
            try {
                sound.pause();
                sound.currentTime = 0;
            } catch (e) {
                // Ignore sync errors
            }
        }
    }
}
