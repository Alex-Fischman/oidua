Array.prototype.sum = function() {
	return this.reduce((a, b) => a + b, 0);
}

const input = document.getElementById("input");
const console = document.getElementById("console");
console.clear = () => console.value = "";
console.error = text => console.value += `${text}\n`;

const note = note => ({
	duration: 1,
	notes: t => (t < 0 || t > 1)? []: [{note, volume: Math.sin(Math.PI * t)}],
});

const rest = () => ({
	duration: 1,
	notes: t => [],
});

const parallel = (...songs) => ({
	duration: Math.max(...songs.map(song => song.duration), 0),
	notes: t => songs.flatMap(song => song.notes(t)),
});

const series = (...songs) => {
	const ds = songs.map(song => song.duration);
	const partialSums = ds.map((_, i) => ds.slice(0, i).sum());
	return {
		duration: ds.sum(),
		notes: t => songs.flatMap((song, i) => song.notes(t - partialSums[i])),
	};
};

const pitch = (p, song) => ({
	duration: song.duration,
	notes: t => song.notes(t).map(({note, volume}) => ({note: note + p, volume})),
});

const length = (l, song) => ({
	duration: song.duration * l,
	notes: t => song.notes(t / l),
});

const volume = (v, song) => ({
	duration: song.duration,
	notes: t => song.notes(t).map(({note, volume}) => ({note, volume: volume * v})),
});

const sample = (song, time) => song.notes(time)
	.map(({note, volume}) => volume * Math.cos(2 * Math.PI * time * 440 * Math.pow(2, note / 12)))
	.sum() || 0;

let song;
const parse = () => {
	console.clear();

	const text = input.value;
	
	const isBracket = c => "(){}[]".includes(c);
	const isWhitespace = c => " \t\n\r".includes(c);
	const isLetter = c => /[_a-zA-Z]/.test(c);
	const isNumber = c => /[0-9]/.test(c);
	const isOperator = c => !isBracket(c) && !isWhitespace(c) && !isLetter(c) && !isNumber(c);

	let lexed = [text[0]];
	for (let i = 1; i < text.length; i++) {
		const c = text[i];
		const d = lexed[lexed.length - 1];
		if ((isLetter(c) && isLetter(d)) || 
		    (isNumber(c) && isNumber(d)) || 
		    (isOperator(c) && isOperator(d))) {
			lexed[lexed.length - 1] += c;
		} else {
			lexed.push(c);
		}
	}
	lexed = lexed.filter(s => !" \t\n\r".includes(s));

	function parse(context, target) {
		let stack = [];
		for (; context.i < lexed.length; context.i++) {
			const a = lexed[context.i];
			if (a === target) return stack;
			else if (isWhitespace(a)) {}
			else if (a === '_') stack.push(rest());
			else if (!Number.isNaN(parseFloat(a))) stack.push(note(parseFloat(a)));
			else if (context.vars.hasOwnProperty(a)) stack.push(context.vars[a]);
			else {
				context.i++;
				const b = lexed[context.i];
				if (a === "=") context.vars[b] = stack.pop();
				else if (a === "(") stack.push(...parse(context, ")"));
				else if (a === "[") stack.push(series(...parse(context, "]")));
				else if (a === "{") stack.push(parallel(...parse(context, "}")));
				else {
					const p = parseFloat(b);
					if (a === "<") stack.push(length(1 / p, stack.pop()));
					else if (a === ">") stack.push(length(p, stack.pop()));
					else if (a === "^") stack.push(volume(p, stack.pop()));
					else if (a === "v") stack.push(volume(1 / p, stack.pop()));
					else if (a === "+") stack.push(pitch(p, stack.pop()));
					else if (a === "-") stack.push(pitch(-p, stack.pop()));
					else console.error(`unknown command ${a}`);

					if (Number.isNaN(p)) console.error(`invalid parameter ${b}`);
				}
			}
		}
		if (target) console.error(`missing ${target}`);
		return stack;
	}

	let stack = parse({i: 0, vars: {}}, "");
	if (stack.length > 1) console.error("stack too large");
	song = stack.length? stack.pop(): rest();
};

const canvas = document.getElementById("canvas");

canvas.addEventListener("click", async () => {
	const context = new AudioContext();
	
	const S = context.sampleRate;
	const buffer = context.createBuffer(1, S, S);
	const channel = buffer.getChannelData(0);
	const fillBuffer = (start, end) => {
		for (let i = start * S; i < end * S; i++) channel[i % S] = sample(song, i / S);
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

const render = () => {
	const context = canvas.getContext("2d", { willReadFrequently: true });
	const {width: w, height: h} = canvas.getBoundingClientRect();
	canvas.width = w;
	canvas.height = h;
	context.fillStyle = "#111";
	context.fillRect(0, 0, w, h);
	for (let x = 0; x < w; x++) for (const {note, volume} of song.notes(x / w * song.duration)) {
		const y = h / 2 - note / 24 * h - h / 24;
		const old = (context.getImageData(x, y, 1, 1).data[0] - 0x11) / (0xEE - 0x11);
		const intensity = (0xEE - 0x11) * (volume + old) + 0x11;
		context.fillStyle = `rgb(${intensity}, ${intensity}, ${intensity})`;
		context.fillRect(x, y, 1, h / 24);
	}
	context.fillStyle = "#EEE";
	for (let x = 0; x <= w; x += w / song.duration) context.fillRect(x, 0, 1, h);
	for (let y = 0; y <= h; y += h / 24) context.fillRect(0, y, w, 1);
};

const update = () => { parse(); render(); };
update();
input.addEventListener("input", update);
