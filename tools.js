'use strict';

const tools = (function()
{
	let _dictionary = {};
	let _lang = null;
	let _dictionaryEvent = new Event('dictionary_setlanguage');
	let _dialog = [];
	let _dialogMask = [];
	let _dialogIndex = -1;
	let _tools = {
		'dictionary': 
		{
			'start': function()
			{
				let loader = $.Deferred();

				$.get('dictionary.json')
					.then(
						function(data)
						{
							_dictionary = data;

							for (let i in window.navigator.languages)
							{
								let lang = window.navigator.languages[i];

								if (_dictionary[lang])
								{
									_lang = lang;
									break;
								}
								if (lang.length === 5 && _dictionary[lang.substr(0, 2)])
								{
									_lang = lang.substr(0, 2);
									break;
								}
							}

							if (_lang === null)
							{
								_lang = Object.keys(_dictionary)[0];
							}

							_tools.dictionary.lang = _lang;
							loader.resolve();
						},
						function(response)
						{
							throw 'Failed to load dictionary';
						}
					);

				return loader;
			},
			'lang': null,
			'setLang': function(lang)
			{
				if (_dictionary[lang])
				{
					_lang = lang;
					document.dispatchEvent(_dictionaryEvent);
					return true;
				}
				return false;
			},
			'get': function(term, index, defaultValue)
			{
				if (defaultValue === undefined && typeof index === 'string')
				{
					return (_dictionary[_lang] && _dictionary[_lang][term]) || index;
				}
				if (index === undefined)
				{
					return (_dictionary[_lang] && _dictionary[_lang][term]) || defaultValue || term;
				}
				if (_dictionary[_lang] && _dictionary[_lang][term])
				{
					return _dictionary[_lang][term][index] || (term + index);
				}
				return term + index;
			},
			'getLanguages': function()
			{
				let list = {};

				for (let lang in _dictionary)
				{
					list[lang] = _dictionary[lang]['_lang'];
				}

				if (Object.keys(list).length > 1)
				{
					return list;
				}
				return {};
			},
			'formatDate': function(date, format)
			{
				if (typeof date === 'string')
				{
					date = new Date(date);
				}

				let dateStr = _dictionary[_lang][format || '_date'] || '%yyyy-%mm-%dd';
				let month = date.getMonth() + 1;
				let day = date.getDate();
				let hours = date.getHours();
				let minutes = date.getMinutes();

				if (dateStr.indexOf('%a') === -1)
				{
					dateStr = dateStr.replace('%yyyy', date.getFullYear());
					dateStr = dateStr.replace('%yy', date.getYear());
					dateStr = dateStr.replace('%dd', leftPad(day, 2, '0'));
					dateStr = dateStr.replace('%d', day);
					dateStr = dateStr.replace('%mm', leftPad(month, 2, '0'));
					dateStr = dateStr.replace('%m', month);
					dateStr = dateStr.replace('%hh', leftPad(hours, 2, '0'));
					dateStr = dateStr.replace('%h', hours);
					dateStr = dateStr.replace('%nn', leftPad(minutes, 2, '0'));
					dateStr = dateStr.replace('%n', minutes);
				}
				else
				{
					dateStr = dateStr.replace('%yyyy', date.getFullYear());
					dateStr = dateStr.replace('%yy', date.getYear());
					dateStr = dateStr.replace('%mm', leftPad(month, 2, '0'));
					dateStr = dateStr.replace('%m', month);
					dateStr = dateStr.replace('%dd', leftPad(day, 2, '0'));
					dateStr = dateStr.replace('%d', day);
					dateStr = dateStr.replace('%nn', leftPad(minutes, 2, '0'));
					dateStr = dateStr.replace('%n', minutes);
					if (hours >= 12)
					{
						dateStr = dateStr.replace('%a', 'PM');
						hours = hours - 12;
					}
					else
					{
						dateStr = dateStr.replace('%a', 'AM');
					}
					hours = (hours === 0 ? 12 : hours);
					dateStr = dateStr.replace('%hh', leftPad(hours, 2, '0'));
					dateStr = dateStr.replace('%h', hours);
				}

				return dateStr;
			}
		}, // dictionary

		'showDialog': function(message, buttons, template)
		{
			document.body.style.overflow = 'hidden';

			return (function(dialogIndex)
			{
				if (!_dialog[dialogIndex])
				{
					_dialog[dialogIndex] = $('<div class="smDialog level' + (dialogIndex % 3) + ' ng-hide" data-ng-controller="DialogController"><span class="message"></span><p></p><div class="buttons"></div></div>');
					_dialogMask[dialogIndex] = $('<div class="smDialogMask level' + (dialogIndex % 3) + ' ng-hide"></div>');
					$(document.body)
						.append(_dialog[dialogIndex])
						.append(_dialogMask[dialogIndex]);
				}
	
				let messageText;
	
				if ($.isArray(message))
				{
					messageText = _tools.dictionary.get(message[0]);
	
					for (let i = 1; i < message.length; i++)
					{
						messageText = messageText.replace(message[i].key, _tools.dictionary.get(message[i].message, message[i].index));
					}
				}
				else
				{
					messageText = _tools.dictionary.get(message);
				}

	
				let dialog = _dialog[dialogIndex];
				let dialogMask = _dialogMask[dialogIndex];
				let dialogElements = dialog.find('p');
				let dialogButtons = dialog.find('div');
				let templateElements = {};
				let firstElement;
				let hotkeyMap = {};
				let hotkeyList = [];
				
				dialog.find('span').text(messageText);
				dialogElements.empty();
				dialogButtons.empty();

				if (template)
				{
					for (let i = 0; i < template.length; i++)
					{
						let item = template[i];
						let element = $('<span></span>');

						element.attr('class', item.class);

						switch (item.type)
						{
							case 'text':
							{
								element.text(_tools.dictionary.get(item.text));
								break;
							}
							case 'html':
							{
								element.html(item.html);
								break;
							}
							case 'input':
							case 'email':
							case 'number':
							case 'range':
							case 'search':
							{
								let input = $('<input/>');

								input.attr('type', item.type === 'input' ? 'text' : item.type);
								input.attr('maxlength', item.maxlength);
								input.attr('min', item.min);
								input.attr('max', item.max);
								input.attr('step', item.step);
								input.attr('value', item.default);

								if (item.placeholder)
								{
									input.attr('placeholder', _tools.dictionary.get(item.placeholder));
								}

								if (item.onchange)
								{
									input.bind('change', item.onchange);
								}

								templateElements[item.name || item.type + i] = input;
								
								if (!firstElement)
								{
									firstElement = input;
								}

								element.append(input);
								break;
							}
						}

						dialogElements.append(element);
					} // for (template)
				} // if (template)

				if (!buttons)
				{
					buttons = [{
						text: 'close',
						default: true,
						cancel: true
					}];
				}

				for (let i = 0; i < buttons.length; i++)
				{
					let button = buttons[i];
					let element = $('<button></button>');				

					element.text(_tools.dictionary.get(button.text, button.index));
					element[0].clickEvent = button.onclick; 
					element.on(
						"click",
						function()
						{
							if (this.clickEvent) 
							{
								let returnValue = this.clickEvent(templateElements);

								if (returnValue)
								{
									if (returnValue.then)
									{
										returnValue.then(function()
										{
											CloseDialog();
										});
									}
									return;
								}
							}
							CloseDialog();
						}
					);

					if (button.default)
					{
						hotkeyMap['Enter'] = element;
					}
					if (button.cancel)
					{
						hotkeyMap['Escape'] = element;
					}
					if (button.hotkey)
					{
						hotkeyMap[button.hotkey] = element;
					}

					dialogButtons.append(element);
				} // for (buttons)

				if (Object.keys(hotkeyMap).length > 0)
				{
					hotkeyList = Object.keys(hotkeyMap);
					window.addEventListener('keydown', onkeypress);
				}

				dialogMask
					.css({ 'z-index': 1000 + 2 * dialogIndex })
					.show();
				dialog
					.css({ 'z-index': 1000 + 2 * dialogIndex + 1 })
					.show();

				if (firstElement)
				{
					firstElement[0].focus();
					if (firstElement[0].select)
					{
						firstElement[0].select();
					}
				}

				function onkeypress(event)
				{
					if (hotkeyList.indexOf(event.key) !== -1 && dialogIndex === _dialogIndex)
					{
						hotkeyMap[event.key][0].click();
						event.stopImmediatePropagation();
						return true;
					}
				}

				return CloseDialog;

				function CloseDialog()
				{
					_dialog[dialogIndex].hide();
					_dialogMask[dialogIndex].hide();
					--_dialogIndex;
	
					window.removeEventListener('keydown', onkeypress);
	
					if (_dialogIndex === -1)
					{
						document.body.style.overflow = '';
					}
				}
					
			})(++_dialogIndex); // return new function()
		}, // showDialog

		'dialog':
		{
			'ok': function(message)
			{
				_tools.showDialog(message);
			},

			'yesNo': function(message, yesCallback, noCallback)
			{
				_tools.showDialog(
					message,
					[
						{
							text: 'yes',
							hotkey: _tools.dictionary.get('yes-key'),
							default: true,
							onclick: yesCallback
						},
						{
							text: 'no',
							hotkey: _tools.dictionary.get('no-key'),
							cancel: true,
							onclick: noCallback
						}
					]
				);
			}, // .yesNo()

			'input': function(message, acceptCallback, cancelCallback, defaultText)
			{
				if (cancelCallback && !$.isFunction(cancelCallback))
				{
					if (!defaultText)
					{
						defaultText = cancelCallback;
					}
					cancelCallback = function() {};
				}

				_tools.showDialog(
					message,
					[
						{
							text: 'ok',
							default: true,
							onclick: function(items)
							{
								return acceptCallback(items['inputText'].val());
							}
						},
						{
							text: 'cancel',
							cancel: true,
							onclick: cancelCallback
						}
					],
					[{
						type: 'input',
						name: 'inputText',
						default: defaultText
					}]
				);
			} // .input()
		}, //dialog
		
		setUnselectable: function(element)
		{
			element.onselectstart = function() { return false; };
			element.style.MozUserSelect = "none";
			element.style.KhtmlUserSelect = "none";
			element.unselectable = "on";
		} // setUnselectable
	};

	return _tools;


	function leftPad(number, length, padChar)
	{
		let output = number.toString();

		if (output.length < length)
		{
			return (padChar || '0').toString().substr(0, 1).repeat(length - output.length) + output;
		}

		return output.slice(-length);
	};

})();
