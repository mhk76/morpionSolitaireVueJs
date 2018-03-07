'use strict';

const __boardSize = 30;
const __gridSize = 20;
const __gridOffset = 10;
const __gridLine = __gridSize / 2;
const __canvasSize = __boardSize * __gridSize + 1;
const __lineMax = 4;
const __dirUpLeft = 0;
const __dirUp = 1;
const __dirUpRight = 2;
const __dirLeft = 3;
const __dirRight = 4;
const __dirDownLeft = 5;
const __dirDown = 6;
const __dirDownRight = 7;
const __line = [
	{ x: -1, y: -1, reverse: __dirDownRight },
	{ x: 0, y: -1, reverse: __dirDown },
	{ x: 1, y: -1, reverse: __dirDownLeft },
	{ x: -1, y: 0, reverse: __dirRight },
	{ x: 1, y: 0, reverse: __dirLeft },
	{ x: -1, y: 1, reverse: __dirUpRight },
	{ x: 0, y: 1, reverse: __dirUp },
	{ x: 1, y: 1, reverse: __dirUpLeft }
];
const __defaultBoard = parseBoard(
		'   oooo   |'
	+ '   o  o   |'
	+ '   o  o   |'
	+ 'oooo  oooo|'
	+ 'o        o|'
	+ 'o        o|'
	+ 'oooo  oooo|'
	+ '   o  o   |'
	+ '   o  o   |'
	+ '   oooo   ');
const statePlaceDot = 0;
const stateLineStart = 1;
const stateLineDrawStart = 2
const stateLineDraw = 3
const stateDone = 4;

const dictionary = serverManagerTools.dictionary;
const dialog = serverManagerTools.dialog;
const server = serverManagerTools.server;

Math.TAU = 2 * Math.PI;
Math.Tan16th = Math.tan(Math.PI / 8);
Math.TanThree16th = Math.tan(3 * Math.PI / 8)

let _canvas;
let _app;
let _highscores = server.readStore('highscores') || [];
let _moves = [];

$.when(
	dictionary.start(),
	server.start({ webSocket: false })
)
.then(function()
{
	_app = new Vue({
		el: '#morpionSolitaire',
		data: {
			languageList: [],
			lang: null,
			board: JSON.parse(__defaultBoard),
			highscores: [],
			state: statePlaceDot,
			ordinal: 0,
			selectionX: null,
			selectionY: null
		},
		filters: {
			dictionary: dictionary.get,
			formatDate: dictionary.formatDate
		},
		methods: {
			finish: finish,
			newGame: newGame,
			setLanguage: function(lang)
			{
				dictionary.setLang(lang);
				server.writeStore('lang', lang, true);
				this.lang = lang;
			}
		}
	});

	_app.languageList = dictionary.getLanguages();
	_app.lang = server.readStore('lang');

	if (_app.lang)
	{
		dictionary.setLang(_app.lang);
	}
	else
	{
		_app.lang = dictionary.lang;
	}

	let board = document.getElementById('board');

	_canvas = board.getContext('2d');
	_canvas.font = '8px Arial'
	_canvas.fillStyle = '#000';
	_canvas.lineWidth = 2;	

	$(board)
		.on('mousemove', function(event)
		{
			_app.selectionX = parseInt((event.offsetX - __gridOffset) / __gridSize + 0.5);
			_app.selectionY = parseInt((event.offsetY - __gridOffset) / __gridSize + 0.5);

			drawGrid();
		})
		.on('mousedown', function(event)
		{
			event.preventDefault();

			if (event.button === 0)
			{
				if (_app.state === stateLineStart && _app.board.grid[_app.selectionY][_app.selectionX] != null)
				{
					_app.lineX = _app.selectionX;
					_app.lineY = _app.selectionY;
					_app.state = stateLineDrawStart;
					drawGrid();
				}
				return false;
			} // if (event.button === 0)

			if (event.button === 2)
			{
				if (_app.state === stateLineDraw)
				{
					_app.state = stateLineStart;
					drawGrid();
					return false;
				}

				undo();
			} // if (event.button === 2)

			return false;

		}) // .on('mousedown')
		.on('mouseup', function(event)
		{
			if (event.button !== 0)
			{
				event.preventDefault();
				return false;
			}

			if (_app.state === statePlaceDot)
			{
				if (_app.board.grid[_app.selectionY][_app.selectionX] == null)
				{
					let item = {
						x: _app.selectionX,
						y: _app.selectionY,
						line: [0, 0, 0, 0, 0, 0, 0, 0],
						ordinal: ++_app.ordinal
					}
					_app.board.grid[_app.selectionY][_app.selectionX] = _app.board.list.length; 
					_app.board.list.push(item);
					_app.state = stateLineStart;

					drawGrid();

					_moves.push({
						dot: 1,
						x: _app.selectionX,
						y: _app.selectionY
					});
				}
				return;
			} // if (_app.state === statePlaceDot)

			if (_app.state === stateLineDrawStart)
			{
				_app.state = stateLineDraw;
				return;
			} // if (_app.state === stateLineDrawStart)
			
			if (_app.state === stateLineDraw)
			{
				let line = checkLine();

				if (line.ok)
				{
					let ix = _app.lineX;
					let iy = _app.lineY;

					_moves.push({
						x: ix,
						y: iy,
						dir: line.direction
					});

					for (let i = 0; i <= __lineMax; i++)
					{
						if (i < __lineMax)
						{
							_app.board.list[_app.board.grid[iy][ix]].line[line.direction] = 1;
						}
						if (i > 0)
						{
							_app.board.list[_app.board.grid[iy][ix]].line[line.reverse] = 1;
						}

						ix += line.x;
						iy += line.y;
					}

					_app.state = statePlaceDot;

					++_app.board.lineCount;
				} // if (line.ok)

				drawGrid();

				return;
			} // if (_app.state === stateLineDraw)

			drawGrid();

		}); // .on('mouseup')

	server.fetch('init').then(function(initData)
	{
		$.extend(_app, initData);
		showHighscores();
		drawGrid();
	});
}); // $.when().then()

window.onbeforeunload =
	function(e)
	{
		return (_app.state !== stateDone && _app.board.lineCount > 0) ? true : null;
	};

function finish()
{
	dialog.input(
		'enter-your-name',
		checkEnter,
		server.readStore('userName')
	);

	function checkEnter(name)
	{
		if (!name)
		{
			dialog.ok('enter-your-name');
			return true;
		}

		_app.state = stateDone;

		server.writeStore('userName', name, true);
		server.fetch(
			'submit',
			{
				board: 0,
				dots: 5,
				moves: _moves,
				name: name
			}
		).then(function(data)
		{
			if (data.message)
			{
				dialog.ok(data.message);
				delete data.message;
			}
			$.extend(_app, data);

			let today = new Date();
			let index = -1;

			// Add the new result into own highscores
			for (let i = 0; i < _highscores.length; i++)
			{
				if (_moves.length > _highscores[i].moves.length)
				{
					index = i;
					break;
				}
				if (
					_moves.length === _highscores[i].moves.length
					&& JSON.stringify(_moves) === JSON.stringify(_highscores[i].moves)
				)
				{
					index = null;
					break;
				}
			}

			if (index === -1)
			{
				_highscores.push({
					name: name,
					lineCount: parseInt(_moves.length / 2),
					date: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
					moves: _moves
				});
			}
			else if (index !== null)
			{
				_highscores.splice(
					index, 0,
					{
						name: name,
						lineCount: parseInt(_moves.length / 2),
						date: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
						moves: _moves
					}
				)
			}

			server.writeStore('highscores', _highscores, true);

			showHighscores();
		});

		_app.state = stateDone;
		drawGrid();

	} // function checkEnter()

}; // function finish()

function newGame()
{
	_app.board = JSON.parse(__defaultBoard);
	_moves = [];
	_app.state = statePlaceDot;
	_app.ordinal = 0;

	drawGrid();
}; // function newGame()


function showHighscores()
{
	for (let i = 0; i < _app.highscores.length; i++)
	{
		for (let j = 0; j < _highscores.length; j++)
		{
			if (
				_app.highscores[i].moves.length === _highscores[j].moves.length
				&& JSON.stringify(_app.highscores[i].moves) === JSON.stringify(_highscores[j].moves)
			)
			{
				_app.highscores[i].own = true;
				break;
			}
		}
	}
}

function drawGrid()
{
	_canvas.clearRect(0, 0, __canvasSize, __canvasSize);

	let dy = __gridOffset;
	let line = {
		x: 0,
		y: 0,
		ok: false
	};

	if (_app.state === stateLineDraw || _app.state === stateLineDrawStart)
	{
		line = checkLine();
	}

	for (let y = 0; y < __boardSize; y++)
	{
		let dx = __gridOffset;

		for (let x = 0; x < __boardSize; x++)
		{
			let item = _app.board.list[_app.board.grid[y][x]];

			if (x === _app.selectionX && y === _app.selectionY)
			{
				drawItem(dx, dy, item, line);
			}
			if (item != null)
			{
				defaultDot(dx, dy, item);
			}

			dx += __gridSize;
		}

		dy += __gridSize;
	} // for (__boardSize)


	function drawItem(dx, dy, item, line)
	{
		if (_app.state === stateDone)
		{
			return;
		}

		if (_app.state === statePlaceDot)
		{
			_canvas.beginPath();
			_canvas.fillStyle = (item == null ? '#000' : '#c00');
			_canvas.arc(dx, dy, 7, 0, Math.TAU);
			_canvas.fill();
			return;
		} // if (_app.state === statePlaceDot)

		if (_app.state === stateLineDraw || _app.state === stateLineDrawStart)
		{
			_canvas.beginPath();
			_canvas.lineWidth = 3;
			_canvas.moveTo(
				_app.lineX * __gridSize + __gridOffset,
				_app.lineY * __gridSize + __gridOffset
			);
			_canvas.lineTo(
				(_app.lineX + line.x * __lineMax) * __gridSize + __gridOffset,
				(_app.lineY + line.y * __lineMax) * __gridSize + __gridOffset
			);
			_canvas.strokeStyle = (line.ok ? '#0a0' : '#c00');
			_canvas.stroke();
			return;
		} // if (_app.state === stateLineDraw)

		_canvas.beginPath();
		_canvas.moveTo(dx - __gridLine, dy - __gridLine);
		_canvas.lineTo(dx + __gridLine, dy + __gridLine);
		_canvas.moveTo(dx - __gridLine, dy + __gridLine);
		_canvas.lineTo(dx + __gridLine, dy - __gridLine);
		_canvas.moveTo(dx - __gridLine, dy);
		_canvas.lineTo(dx + __gridLine, dy);
		_canvas.moveTo(dx, dy - __gridLine);
		_canvas.lineTo(dx, dy + __gridLine);
		_canvas.strokeStyle = (item != null ? '#0a0' : '#c00');
		_canvas.lineWidth = 3;
		_canvas.stroke();
	} // function drawItem()

	function defaultDot(dx, dy, item)
	{
		_canvas.beginPath();
		_canvas.arc(dx, dy, 7, 0, Math.TAU);
		_canvas.lineWidth = 1;
		_canvas.strokeStyle = '#000';
		_canvas.stroke();

		if (item.ordinal)
		{
			let ordinal = item.ordinal.toString();		
			_canvas.fillText(ordinal, dx - parseInt(_canvas.measureText(ordinal).width / 2), dy + 3);
		}

		_canvas.beginPath();
		_canvas.lineWidth = 3;

		if (item.line[__dirUp])
		{
			_canvas.moveTo(dx, dy - 7);
			_canvas.lineTo(dx, dy - __gridSize / 2);
		}
		if (item.line[__dirUpRight])
		{
			_canvas.moveTo(dx + 5, dy - 5);
			_canvas.lineTo(dx + __gridSize / 2, dy - __gridSize / 2);
		}
		if (item.line[__dirRight])
		{
			_canvas.moveTo(dx + 7, dy);
			_canvas.lineTo(dx + __gridSize / 2, dy);
		}
		if (item.line[__dirDownRight])
		{
			_canvas.moveTo(dx + 5, dy + 5);
			_canvas.lineTo(dx + __gridSize / 2, dy + __gridSize / 2);
		}
		if (item.line[__dirDown])
		{
			_canvas.moveTo(dx, dy + 7);
			_canvas.lineTo(dx, dy + __gridSize / 2);
		}
		if (item.line[__dirDownLeft])
		{
			_canvas.moveTo(dx - 5, dy + 5);
			_canvas.lineTo(dx - __gridSize / 2, dy + __gridSize / 2);
		}
		if (item.line[__dirLeft])
		{
			_canvas.moveTo(dx - 7, dy);
			_canvas.lineTo(dx - __gridSize / 2, dy);
		}
		if (item.line[__dirUpLeft])
		{
			_canvas.moveTo(dx - 5, dy - 5);
			_canvas.lineTo(dx - __gridSize / 2, dy - __gridSize / 2);
		}
		_canvas.stroke();
	} // function defaultDot()

} // function drawGrid()

function undo()
{
	if (_moves.length === 0)
	{
		return;
	}

	let undo = _moves.pop();

	if (undo.dot)
	{
		_app.board.grid[undo.y][undo.x] = null;
		_app.board.list.pop();
		_app.state = statePlaceDot;
		--_app.ordinal;

		drawGrid();

		return;
	}

	let line = __line[undo.dir];

	for (let i = 0; i <= __lineMax; i++)
	{
		if (i < __lineMax)
		{
			_app.board.list[_app.board.grid[undo.y][undo.x]].line[undo.dir] = 0;
		}
		if (i > 0)
		{
			_app.board.list[_app.board.grid[undo.y][undo.x]].line[line.reverse] = 0;
		}

		undo.x += line.x;
		undo.y += line.y;
	}

	_app.state = stateLineStart;
	--_app.board.lineCount;

	drawGrid();

} // function undo()

function checkLine()
{
	let dx = (_app.selectionX - _app.lineX) * __gridSize; 
	let dy = (_app.selectionY - _app.lineY) * __gridSize;
	let tan = (dx !== 0 ? dy / dx : dy);
	let output = {
		x: 0,
		y: 0,
		direction: 0,
		reverse: 0,
		ok: false
	};

	if (dx < 0)
	{
		if (tan > Math.TanThree16th)
		{
			output.direction = __dirUp;
			output.reverse = __dirDown;
		}
		else if (tan > Math.Tan16th)
		{
			output.direction = __dirUpLeft;
			output.reverse = __dirDownRight;
		}
		else if (tan > -Math.Tan16th)
		{
			output.direction = __dirLeft;
			output.reverse = __dirRight;
		}
		else if (tan > -Math.TanThree16th)
		{
			output.direction = __dirDownLeft;
			output.reverse = __dirUpRight
		}
		else
		{
			output.direction = __dirDown;
			output.reverse = __dirUp;
		}
	}
	else // if (dx >= 0)
	{
		if (tan > Math.TanThree16th)
		{
			output.direction = __dirDown;
			output.reverse = __dirUp;
		}
		else if (tan > Math.Tan16th)
		{
			output.direction = __dirDownRight;
			output.reverse = __dirUpLeft;
		}
		else if (tan > -Math.Tan16th)
		{
			output.direction = __dirRight;
			output.reverse = __dirLeft;
		}
		else if (tan > -Math.TanThree16th)
		{
			output.direction = __dirUpRight;
			output.reverse = __dirDownLeft;
		}
		else
		{
			output.direction = __dirUp;
			output.reverse = __dirDown;
		}
	} // if (dx >= 0)

	output.x = __line[output.direction].x;
	output.y = __line[output.direction].y;

	let ix = _app.lineX;
	let iy = _app.lineY;

	for (let i = 0; i <= __lineMax; i++)
	{
		if (check(ix, iy, output.direction, output.reverse, i === 0, i === __lineMax))
		{
			return output;
		}

		ix += output.x;
		iy += output.y;
	}

	output.ok = true;

	return output;

	function check(x, y, direction, reverse, first, last)
	{
		let i = _app.board.grid[y][x];

		if (i == null)
		{
			return true;
		}

		let item = _app.board.list[i];

		if (!last && item.line[direction])
		{
			return true;
		}
		if (!first && item.line[reverse])
		{
			return true;
		}
		return false;
	}

} // function checkLine()

function parseBoard(input)
{
	let lines = input.split('|');
	let output = {
		grid: new Array(__boardSize),
		list: [],
		lineCount: 0
	};
	let y = __boardSize / 2 - parseInt(lines.length / 2 + 0.5);

	for (let i = 0; i < __boardSize; i++)
	{
		output.grid[i] = new Array(__boardSize);
	}

	for (let i = 0; i < lines.length; i++)
	{
		let chars = lines[i].split('');
		let x = __boardSize / 2 - parseInt(chars.length / 2 + 0.5);

		for (let j = 0; j < chars.length; j++)
		{
			if (chars[j] != ' ')
			{
				output.grid[y][x] = output.list.length;  
				output.list.push({
					x: x,
					y: y,
					line: [0, 0, 0, 0, 0, 0, 0, 0]
				});
			}
			++x;
		}
		++y;
	}

	return JSON.stringify(output);
} // function parseBoard()
