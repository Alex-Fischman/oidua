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
	duration: Math.max(...songs.map(song => song.duration)),
	notes: t => songs.flatMap(song => song.notes(t)),
});

const series = (...songs) => {
	const ds = songs.map(song => song.duration);
	const sums = ds.map((_, i) => ds.slice(0, i).sum());
	return {
		duration: ds.sum(),
		notes: t => songs.flatMap((song, i) => song.notes(t - sums[i])),
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

	const parseDigit = string =>
		string === '0'? 0:
		string === '1'? 1:
		string === '2'? 2:
		string === '3'? 3:
		string === '4'? 4:
		string === '5'? 5:
		string === '6'? 6:
		string === '7'? 7:
		string === '8'? 8:
		string === '9'? 9:
		string === 'X'? 10:
		string === 'E'? 11:
		string === 'T'? 12:
		null;

	const parseName = context => {
		let name = context.text[context.i];
		for (; context.i < context.text.length; context.i++) {
			const c = context.text[context.i + 1];
			if (" \n\r_(){}[]$=<>^v+-".includes(c)) break;
			name += c;
		}
		return name;
	};

	function parse(context, target) {
		let stack = [];
		for (; context.i < context.text.length; context.i++) {
			const a = context.text[context.i];
			if (a === target) return stack;
			else if (a === '$') {
				context.i++;
				const name = parseName(context);
				if (context.vars.hasOwnProperty(name)) stack.push(context.vars[name]);
				else console.error(`unknown variable ${name}`);
			}
			else if (a === ' ' || a === '\n' || a === '\r') {}
			else if (a === '_') stack.push(rest());
			else if (parseDigit(a) !== null) stack.push(note(parseDigit(a)));
			else {
				context.i++;
				     if (a === '(') stack.push(...parse(context, ')'));
				else if (a === '[') stack.push(series(...parse(context, ']')));
				else if (a === '{') stack.push(parallel(...parse(context, '}')));
				else if (a === "=") context.vars[parseName(context)] = stack.pop();
				else {
					const b = parseDigit(context.text[context.i]);
					if (b === null) console.error(`invalid parameter ${context.text[context.i]}`);
					else if (a === "<") stack.push(length(1 / b, stack.pop()));
					else if (a === ">") stack.push(length(b, stack.pop()));
					else if (a === "^") stack.push(volume(b, stack.pop()));
					else if (a === "v") stack.push(volume(1 / b, stack.pop()));
					else if (a === "+") stack.push(pitch(b, stack.pop()));
					else if (a === "-") stack.push(pitch(-b, stack.pop()));
					else console.error(`unknown command ${a}`);
				}
			}
		}
		if (target) console.error(`missing ${target}`);
		return stack;
	}

	let stack = parse({text: input.value, i: 0, vars: {}}, "");
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
	const context = canvas.getContext("2d");
	const {width: w, height: h} = canvas.getBoundingClientRect();
	canvas.width = w;
	canvas.height = h;
	context.fillStyle = "#111";
	context.fillRect(0, 0, w, h);
	for (let x = 0; x < w; x++) for (const {note, volume} of song.notes(x / w * song.duration)) {
		const intensity = (0xEE - 0x11) * volume + 0x11;
		context.fillStyle = `rgb(${intensity}, ${intensity}, ${intensity})`;
		context.fillRect(x, h / 2 - note / 24 * h - h / 24, 1, h / 24);
	}
	context.fillStyle = "#EEE";
	for (let x = 0; x <= w; x += w / song.duration) context.fillRect(x, 0, 1, h);
	for (let y = 0; y <= h; y += h / 24) context.fillRect(0, y, w, 1);
};

const update = () => { parse(); render(); };
update();
input.addEventListener("input", update);
