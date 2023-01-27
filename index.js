Array.prototype.sum = function() {
	return this.reduce((a, b) => a + b, 0);
}

class Song {
	constructor(duration, notes) {
		this.duration = duration;
		this.notes = notes;
	}

	static note(note) {
		return new Song(1, t => (t < 0 || t > 1)? []: [{note, volume: Math.sin(Math.PI * t)}]);
	}

	static rest() {
		return new Song(1, t => []);
	}

	static parallel(...songs) {
		return new Song(
			Math.max(...songs.map(song => song.duration)),
			t => songs.flatMap(song => song.notes(t))
		);
	}

	static sequence(...songs) {
		const ds = songs.map(song => song.duration);
		const sums = [...Array(ds.length)].map((_, i) => ds.slice(0, i).sum());
		return new Song(ds.sum(), t => songs.flatMap((song, i) => song.notes(t - sums[i])));
	}

	pitch(p) {
		return new Song(this.duration, t => 
			this.notes(t).map(({note, volume}) => ({note: note + p, volume})));
	}

	length(l) {
		return new Song(this.duration * l, t => this.notes(t / l));
	}

	volume(v) {
		return new Song(this.duration, t => 
			this.notes(t).map(({note, volume}) => ({note, volume: volume * v})));
	}

	reverse() {
		return new Song(this.duration, t => this.notes(this.duration - t));
	}

	sample(time) {
		let amps = this.notes(time).map(({note, volume}) => 
			volume * Math.cos(2 * Math.PI * time * 440 * Math.pow(2, note / 12)));
		return (amps.sum() / amps.length) || 0;
	}
}

const scales = {
	major: [0, 2, 4, 5, 7, 9, 11, 12],
	minor: [0, 2, 3, 5, 7, 8, 10, 12],
	whole: [0, 2, 4, 6, 8, 10, 12],
	penta: [0, 2, 4, 7, 9, 12],
};

const song = Song.sequence(
	Song.note(7), Song.note(4), Song.note(0), Song.note(4),
	Song.note(5).length(2), Song.note(2).length(2),
	Song.note(7), Song.note(4), Song.note(0), Song.note(4),
	Song.note(2).length(2), Song.rest().length(2),
).length(0.25).volume(0.5);

window.addEventListener("keypress", async () => {
	const context = new AudioContext();
	
	const S = context.sampleRate;
	const buffer = context.createBuffer(1, S, S);
	const channel = buffer.getChannelData(0);
	const fillBuffer = (start, end) => {
		for (let i = start * S; i < end * S; i++) channel[i % S] = song.sample(i / S);
	};
	fillBuffer(0, 1, 0);

	const source = context.createBufferSource();
	source.buffer = buffer;
	source.loop = true;
	source.connect(context.destination);

	const start = context.currentTime;
	const update = time => () => {
		if (time > song.duration + 0.5) {
			source.stop();
			return;
		} else {
			fillBuffer(time, time + 0.5);
			setTimeout(update(time + 0.5), (start + time + 0.25 - context.currentTime) * 1000);
		}
	};
	source.start();
	setTimeout(update(1), 750);
});

{
	const canvas = document.getElementById("canvas");
	const context = canvas.getContext("2d");
	const {width: w, height: h} = canvas.getBoundingClientRect();
	canvas.width = w;
	canvas.height = h;
	context.fillStyle = "#111";
	context.fillRect(0, 0, w, h);
	for (let x = 0; x < w; x++) for (const {note, volume} of song.notes(x / w * song.duration)) {
		const intensity = (0xEE - 0x11) * volume + 0x11;
		context.fillStyle = `rgb(${intensity}, ${intensity}, ${intensity})`;
		context.fillRect(x, h / 2 - note / 48 * h - h / 48, 1, h / 48);
	}
	context.fillStyle = "#EEE";
	for (let x = 0; x <= w; x += w / song.duration) context.fillRect(x, 0, 1, h);
	for (let y = 0; y <= h; y += h / 48) context.fillRect(0, y, w, 1);
}
