(function($) {
    $.entwine('ss', function ($) {

        /**
         * Inserts and edits links in an html editor, including internal/external web links,
         * links to files on the webserver, email addresses, and anchors in the existing html content.
         * Every variation has its own fields (e.g. a "target" attribute doesn't make sense for an email link),
         * which are toggled through a type dropdown. Variations share fields, so there's only one "title" field in the form.
         */
         $('form.htmleditorfield-linkform').entwine({

 			// TODO Entwine doesn't respect submits triggered by ENTER key
 			onsubmit: function(e) {
 				this.insertLink();
 				this.getDialog().close();
 				return false;
 			},
 			resetFields: function() {
 				this._super();

 				// Reset the form using a native call. This will also correctly reset checkboxes and radio buttons.
 				this[0].reset();
 			},
 			redraw: function() {
 				this._super();

 				var linkType = this.find(':input[name=LinkType]:checked').val();

 				this.addAnchorSelector();

 				this.resetFileField();

 				// Toggle field visibility depending on the link type.
 				this.find('div.content .field').hide();
 				this.find('.field[id$="LinkType"]').show();
 				this.find('.field[id$="' + linkType +'_Holder"]').show();

 				if(linkType == 'internal' || linkType == 'anchor') {
 					this.find('.field[id$="Anchor_Holder"]').show();
 				}

 				if(linkType == 'email') {
 					this.find('.field[id$="Subject_Holder"]').show();
 				} else {
 					this.find('.field[id$="TargetBlank_Holder"]').show();
 				}

 				if(linkType == 'anchor') {
 					this.find('.field[id$="AnchorSelector_Holder"]').show();
 				}
 				this.find('.field[id$="Description_Holder"]').show();
 			},
 			/**
 			 * @return Object Keys: 'href', 'target', 'title'
 			 */
 			getLinkAttributes: function() {
 				var href,
 					target = null,
 					subject = this.find(':input[name=Subject]').val(),
 					anchor = this.find(':input[name=Anchor]').val();

 				// Determine target
 				if(this.find(':input[name=TargetBlank]').is(':checked')) {
 					target = '_blank';
 				}

 				// All other attributes
 				switch(this.find(':input[name=LinkType]:checked').val()) {
 					case 'internal':
 						href = '[sitetree_link,id=' + this.find(':input[name=internal]').val() + ']';

 						if(anchor) {
 							href += '#' + anchor;
 						}

 						break;

 					case 'anchor':
 						href = '#' + anchor;
 						break;

 					case 'file':
 						href = '[file_link,id=' + this.find('.ss-uploadfield .ss-uploadfield-item').attr('data-fileid') + ']';
 						target = '_blank';
 						break;

 					case 'email':
 						href = 'mailto:' + this.find(':input[name=email]').val();
 						if(subject) {
 							href += '?subject=' + encodeURIComponent(subject);
 						}
 						target = null;
 						break;

                    case 'tel':
                        href = 'tel:' + this.find(':input[name=tel]').val();
                        target = null;
                        break;

 					// case 'external':
 					default:
 						href = this.find(':input[name=external]').val();
 						// Prefix the URL with "http://" if no prefix is found
 						if(href.indexOf('://') == -1) href = 'http://' + href;
 						break;
 				}

 				return {
 					href : href,
 					target : target,
 					title : this.find(':input[name=Description]').val()
 				};
 			},
 			insertLink: function() {
 				this.modifySelection(function(ed){
 					ed.insertLink(this.getLinkAttributes());
 				});
 			},
 			removeLink: function() {
 				this.modifySelection(function(ed){
 					ed.removeLink();
 				});

 				this.resetFileField();
 				this.close();
 			},

 			resetFileField: function() {
 				// If there's an attached item, remove it
 				var fileField = this.find('.ss-uploadfield[id$="file_Holder"]'),
 					fileUpload = fileField.data('fileupload'),
 					currentItem = fileField.find('.ss-uploadfield-item[data-fileid]');

 				if(currentItem.length) {
 					fileUpload._trigger('destroy', null, {context: currentItem});
 					fileField.find('.ss-uploadfield-addfile').removeClass('borderTop');
 				}
 			},

 			/**
 			 * Builds an anchor selector element and injects it into the DOM next to the anchor field.
 			 */
 			addAnchorSelector: function() {
 				// Avoid adding twice
 				if(this.find(':input[name=AnchorSelector]').length) return;

 				var self = this;
 				var anchorSelector = $(
 					'<select id="Form_EditorToolbarLinkForm_AnchorSelector" name="AnchorSelector"></select>'
 				);
 				this.find(':input[name=Anchor]').parent().append(anchorSelector);

 				// Initialise the anchor dropdown.
 				this.updateAnchorSelector();

 				// copy the value from dropdown to the text field
 				anchorSelector.change(function(e) {
 					self.find(':input[name="Anchor"]').val($(this).val());
 				});
 			},

 			/**
 			 * Fetch relevant anchors, depending on the link type.
 			 *
 			 * @return $.Deferred A promise of an anchor array, or an error message.
 			 */
 			getAnchors: function() {
 				var linkType = this.find(':input[name=LinkType]:checked').val();
 				var dfdAnchors = $.Deferred();

 				switch (linkType) {
 					case 'anchor':
 						// Fetch from the local editor.
 						var collectedAnchors = [];
 						var ed = this.getEditor();
 						// name attribute is defined as CDATA, should accept all characters and entities
 						// http://www.w3.org/TR/1999/REC-html401-19991224/struct/links.html#h-12.2

 						if(ed) {
 							var raw = ed.getContent().match(/\s(name|id)="([^"]+?)"|\s(name|id)='([^']+?)'/gim);
 							if (raw && raw.length) {
 								for(var i = 0; i < raw.length; i++) {
 									var indexStart = (raw[i].indexOf('id=') == -1) ? 7 : 5;
 									collectedAnchors.push(raw[i].substr(indexStart).replace(/"$/, ''));
 								}
 							}
 						}

 						dfdAnchors.resolve(collectedAnchors);
 						break;

 					case 'internal':
 						// Fetch available anchors from the target internal page.
 						var pageId = this.find(':input[name=internal]').val();

 						if (pageId) {
 							$.ajax({
 								url: $.path.addSearchParams(
 									this.attr('action').replace('LinkForm', 'getanchors'),
 									{'PageID': parseInt(pageId)}
 								),
 								success: function(body, status, xhr) {
 									dfdAnchors.resolve($.parseJSON(body));
 								},
 								error: function(xhr, status) {
 									dfdAnchors.reject(xhr.responseText);
 								}
 							});
 						} else {
 							dfdAnchors.resolve([]);
 						}
 						break;

 					default:
 						// This type does not support anchors at all.
 						dfdAnchors.reject(ss.i18n._t(
 							'HtmlEditorField.ANCHORSNOTSUPPORTED',
 							'Anchors are not supported for this link type.'
 						));
 						break;
 				}

 				return dfdAnchors.promise();
 			},

 			/**
 			 * Update the anchor list in the dropdown.
 			 */
 			updateAnchorSelector: function() {
 				var self = this;
 				var selector = this.find(':input[name=AnchorSelector]');
 				var dfdAnchors = this.getAnchors();

 				// Inform the user we are loading.
 				selector.empty();
 				selector.append($(
 					'<option value="" selected="1">' +
 					ss.i18n._t('HtmlEditorField.LOOKINGFORANCHORS', 'Looking for anchors...') +
 					'</option>'
 				));

 				dfdAnchors.done(function(anchors) {
 					selector.empty();
 					selector.append($(
 						'<option value="" selected="1">' +
 						ss.i18n._t('HtmlEditorField.SelectAnchor') +
 						'</option>'
 					));

 					if (anchors) {
 						for (var j = 0; j < anchors.length; j++) {
 							selector.append($('<option value="'+anchors[j]+'">'+anchors[j]+'</option>'));
 						}
 					}

 				}).fail(function(message) {
 					selector.empty();
 					selector.append($(
 						'<option value="" selected="1">' +
 						message +
 						'</option>'
 					));
 				});

 				// Poke the selector for IE8, otherwise the changes won't be noticed.
 				if ($.browser.msie) selector.hide().show();
 			},

 			/**
 			 * Updates the state of the dialog inputs to match the editor selection.
 			 * If selection does not contain a link, resets the fields.
 			 */
 			updateFromEditor: function() {
 				var htmlTagPattern = /<\S[^><]*>/g, fieldName, data = this.getCurrentLink();

 				if(data) {
 					for(fieldName in data) {
 						var el = this.find(':input[name=' + fieldName + ']'), selected = data[fieldName];
 						// Remove html tags in the selected text that occurs on IE browsers
 						if(typeof(selected) == 'string') selected = selected.replace(htmlTagPattern, '');

 						// Set values and invoke the triggers (e.g. for TreeDropdownField).
 						if(el.is(':checkbox')) {
 							el.prop('checked', selected).change();
 						} else if(el.is(':radio')) {
 							el.val([selected]).change();
 						} else if(fieldName == 'file') {
 							// UploadField inputs have a slightly different naming convention
 							el = this.find(':input[name="' + fieldName + '[Uploads][]"]');
 							// We need the UploadField "field", not just the input
 							el = el.parents('.ss-uploadfield');

 							// We have to wait for the UploadField to initialise
 							(function attach(el, selected) {
 								if( ! el.getConfig()) {
 									setTimeout(function(){ attach(el, selected); }, 50);
 								} else {
 									el.attachFiles([selected]);
 								}
 							})(el, selected);
 						} else {
 							el.val(selected).change();
 						}
 					}
 				}
 			},

 			/**
 			 * Return information about the currently selected link, suitable for population of the link form.
 			 *
 			 * Returns null if no link was currently selected.
 			 */
 			getCurrentLink: function() {
 				var selectedEl = this.getSelection(),
 					href = "", target = "", title = "", action = "insert", style_class = "";

 				// We use a separate field for linkDataSource from tinyMCE.linkElement.
 				// If we have selected beyond the range of an <a> element, then use use that <a> element to get the link data source,
 				// but we don't use it as the destination for the link insertion
 				var linkDataSource = null;
 				if(selectedEl.length) {
 					if(selectedEl.is('a')) {
 						// Element is a link
 						linkDataSource = selectedEl;
 					// TODO Limit to inline elements, otherwise will also apply to e.g. paragraphs which already contain one or more links
 					// } else if((selectedEl.find('a').length)) {
 						// 	// Element contains a link
 						// 	var firstLinkEl = selectedEl.find('a:first');
 						// 	if(firstLinkEl.length) linkDataSource = firstLinkEl;
 					} else {
 						// Element is a child of a link
 						linkDataSource = selectedEl = selectedEl.parents('a:first');
 					}
 				}
 				if(linkDataSource && linkDataSource.length) this.modifySelection(function(ed){
 					ed.selectNode(linkDataSource[0]);
 				});

 				// Is anchor not a link
 				if (!linkDataSource.attr('href')) linkDataSource = null;

 				if (linkDataSource) {
 					href = linkDataSource.attr('href');
 					target = linkDataSource.attr('target');
 					title = linkDataSource.attr('title');
 					style_class = linkDataSource.attr('class');
 					href = this.getEditor().cleanLink(href, linkDataSource);
 					action = "update";
 				}

                if (href.match(/^tel:(.*)$/)) {
                    return {
                        LinkType: 'tel',
                        tel: RegExp.$1,
                        Description: title
                    }
                } else if(href.match(/^mailto:([^?]*)(\?subject=(.*))?$/)) {
 					return {
 						LinkType: 'email',
 						email: RegExp.$1,
 						Subject: decodeURIComponent(RegExp.$3),
 						Description: title
 					};
 				} else if(href.match(/^(assets\/.*)$/) || href.match(/^\[file_link\s*(?:\s*|%20|,)?id=([0-9]+)\]?(#.*)?$/)) {
 					return {
 						LinkType: 'file',
 						file: RegExp.$1,
 						Description: title,
 						TargetBlank: target ? true : false
 					};
 				} else if(href.match(/^#(.*)$/)) {
 					return {
 						LinkType: 'anchor',
 						Anchor: RegExp.$1,
 						Description: title,
 						TargetBlank: target ? true : false
 					};
 				} else if(href.match(/^\[sitetree_link(?:\s*|%20|,)?id=([0-9]+)\]?(#.*)?$/i)) {
 					return {
 						LinkType: 'internal',
 						internal: RegExp.$1,
 						Anchor: RegExp.$2 ? RegExp.$2.substr(1) : '',
 						Description: title,
 						TargetBlank: target ? true : false
 					};
 				} else if(href) {
 					return {
 						LinkType: 'external',
 						external: href,
 						Description: title,
 						TargetBlank: target ? true : false
 					};
 				} else {
 					// No link/invalid link selected.
 					return null;
 				}
 			}
 		});
    });
})(jQuery);
