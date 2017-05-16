/**
 * Silex, live web creation
 * http://projects.silexlabs.org/?/silex/
 *
 * Copyright (c) 2012 Silex Labs
 * http://www.silexlabs.org/
 *
 * Silex is available under the GPL license
 * http://www.silexlabs.org/silex/silex-licensing/
 */

/**
 * @fileoverview A controller listens to a view element,
 *      and call the main {silex.controller.Controller} controller's methods
 *
 */
goog.provide('silex.controller.EditMenuController');

goog.require('silex.controller.ControllerBase');
goog.require('silex.service.SilexTasks');



/**
 * @constructor
 * @extends {silex.controller.ControllerBase}
 * listen to the view events and call the main controller's methods}
 * @param {silex.types.Model} model
 * @param  {silex.types.View} view  view class which holds the other views
 */
silex.controller.EditMenuController = function(model, view) {
  // call super
  silex.controller.ControllerBase.call(this, model, view);
  // init clipboard
  this.clipboard = [];


  /**
   * invalidation mechanism
   * @type {InvalidationManager}
   */
  this.undoredoInvalidationManager = new InvalidationManager(1000);
};

// inherit from silex.controller.ControllerBase
goog.inherits(silex.controller.EditMenuController, silex.controller.ControllerBase);


/**
 * storage for the clipboard
 * @type Array.<silex.types.ClipboardItem>
 */
silex.controller.EditMenuController.prototype.clipboard = null;


/**
 * storage for the clipboard
 * @type {?Element}
 */
//silex.controller.EditMenuController.prototype.clipboardParent = null;


/**
 * undo the last action
 */
silex.controller.EditMenuController.prototype.undo = function() {
  this.model.body.setSelection([]);
  this.undoredoInvalidationManager.callWhenReady(() => {
    if (silex.controller.ControllerBase.getStatePending === 0 &&
      silex.controller.ControllerBase.undoHistory.length > 0) {
      const state = this.getState();
      silex.controller.ControllerBase.redoHistory.push(state);
      const prevState = silex.controller.ControllerBase.undoHistory.pop();
      this.restoreState(prevState);
    }
    else {
      requestAnimationFrame(() => this.undo());
    }
  });
};


/**
 * redo the last action
 */
silex.controller.EditMenuController.prototype.redo = function() {
  this.model.body.setSelection([]);
  this.undoredoInvalidationManager.callWhenReady(() => {
    if (silex.controller.ControllerBase.redoHistory.length > 0) {
      const state = this.getState();
      silex.controller.ControllerBase.undoHistory.push(state);
      const prevState = silex.controller.ControllerBase.redoHistory.pop();
      this.restoreState(prevState);
    }
  });
};


/**
 * copy the selection for later paste
 */
silex.controller.EditMenuController.prototype.copySelection = function() {
  this.tracker.trackAction('controller-events', 'info', 'copy', 0);
  // default is current selection
  let elements = this.model.body.getSelection();
  // but select the sections instead of their container content
  elements = elements.map(element => {
    if(this.model.element.isSectionContent(element)) {
      const parentNode = /** @type {Element} */ (element.parentNode);
      if(elements.indexOf(parentNode) >= 0) return null;
      return parentNode;
    }
    else {
      return element;
    }
  }).filter(element => !!element);
  if (elements.length > 0) {
    // reset clipboard
    silex.controller.ControllerBase.clipboard = [];
    // add each selected element to the clipboard
    goog.array.forEach(elements, function(element) {
      if (this.model.body.getBodyElement() !== element) {
        // disable editable
        this.model.body.setEditable(element, false);
        // copy the element and its children
        silex.controller.ControllerBase.clipboard.push(this.recursiveCopy(element));
        // re-enable editable
        this.model.body.setEditable(element, true);
        // update the views
        this.model.body.setSelection(this.model.body.getSelection());
      }
      else {
        console.error('could not copy this element (', element, ') because it is the stage element');
      }
    }, this);
  }
};



/**
 * make a copy of a Silex element and its sub-elements (for containers)
 * @param {Element} element
 */
silex.controller.EditMenuController.prototype.recursiveCopy = function(element) {
  // duplicate the node
  var res = {
    element: element.cloneNode(true),
    style: this.model.property.getStyle(element, false),
    mobileStyle: this.model.property.getStyle(element, true),
    children: []
  };
  // case of a container, handle its children
  if (this.model.element.getType(res.element) === silex.model.Element.TYPE_CONTAINER) {
    const toBeRemoved = [];
    const len = res.element.childNodes.length;
    for (let idx = 0; idx < len; idx++) {
      const node = res.element.childNodes[idx];
      if (node.nodeType === 1) {
        const el = /** @type {Element} */ (node);
        if(this.model.element.getType(el) !== null) {
          res.children.push(this.recursiveCopy(el));
          toBeRemoved.push(el);
        }
      }
    }
    toBeRemoved.forEach((el) => res.element.removeChild(el));
  }
  return res;
};


/**
 * paste the previously copied element
 */
silex.controller.EditMenuController.prototype.pasteSelection = function() {
  this.tracker.trackAction('controller-events', 'info', 'paste', 0);
  // default is selected element
  if (silex.controller.ControllerBase.clipboard) {
    // undo checkpoint
    this.undoCheckPoint();
    // take the scroll into account (drop at (100, 100) from top left corner of the window, not the stage)
    const doc = this.model.file.getContentDocument();
    const elements = silex.controller.ControllerBase.clipboard.map(function(item) {return item.element;});
    const selection = [];
    let offset = 0;
    // duplicate and add to the container
    goog.array.forEach(silex.controller.ControllerBase.clipboard, function(clipboardItem) {
      var element = this.recursivePaste(clipboardItem);
      // add to the selection
      selection.push(element);
      // reset editable option
      this.doAddElement(element);
      // add to stage and set the "silex-just-added" css class
      this.model.element.addElementDefaultPosition(element, offset);
      offset += 20;
    }, this);
    // select the new elements
    this.model.body.setSelection(selection);
  }
};


/**
 * paste a Silex element and its sub-elements (for containers)
 * @param {silex.types.ClipboardItem} clipboardItem
 * @return {Element}
 */
silex.controller.EditMenuController.prototype.recursivePaste = function(clipboardItem) {
  var element = clipboardItem.element.cloneNode(true);
  var componentData = this.model.property.getComponentData(clipboardItem.element);
  // reset the ID
  this.model.property.initSilexId(element);
  // init component props
  if(componentData) {
    this.model.property.setComponentData(element, componentData);
    // re-render components (makes inner ID change)
    this.model.component.render(element);
  }
  // keep the original style
  this.model.property.setStyle(element, clipboardItem.style, false);
  this.model.property.setStyle(element, clipboardItem.mobileStyle, true);
  // add its children
  goog.array.forEach(clipboardItem.children, function(childItem) {
    var childElement = this.recursivePaste(childItem);
    // add to stage
    this.model.element.addElement(element, childElement);
    }, this);

  return element;
};


/**
 * remove selected elements from the stage
 */
silex.controller.EditMenuController.prototype.removeSelectedElements = function() {
  var elements = this.model.body.getSelection();
  // confirm and delete
  silex.utils.Notification.confirm('I am about to <strong>delete the selected element(s)</strong>, are you sure?',
      goog.bind(function(accept) {
        if (accept) {
          // undo checkpoint
          this.undoCheckPoint();
          // do remove selected elements
          goog.array.forEach(elements, function(element) {
            this.model.element.removeElement(element);
          }, this);
        }
      }, this), 'delete', 'cancel');
};


/**
 * edit an {Element} element
 * take its type into account and open the corresponding editor
 * @param {?HTMLElement=} opt_element
 */
silex.controller.EditMenuController.prototype.editElement = function(opt_element) {
  // undo checkpoint
  this.undoCheckPoint();
  // default is selected element
  var element = opt_element || this.model.body.getSelection()[0];
  // open the params tab for the components
  // or the editor for the elements
  if(this.model.component.isComponent(element)) {
    this.view.propertyTool.openParamsTab();
  }
  else switch (this.model.element.getType(element)) {
    case silex.model.Element.TYPE_TEXT:
      var bgColor = silex.utils.Style.computeBgColor(element, this.model.file.getContentWindow());
      if (!bgColor) {
        // case where all parents are transparent
        bgColor = [255, 255, 255, 255];
      }
      // open the text editor with the same bg color as the element
      this.view.textEditor.openEditor();
      this.view.textEditor.setValue(this.model.element.getInnerHtml(element));
      this.view.textEditor.setElementClassNames(element.className);
      this.view.textEditor.setBackgroundColor(goog.color.rgbToHex(
          Math.round(bgColor[0]),
          Math.round(bgColor[1]),
          Math.round(bgColor[2])
          ));
      break;
    case silex.model.Element.TYPE_HTML:
      this.view.htmlEditor.openEditor();
      this.view.htmlEditor.setValue(this.model.element.getInnerHtml(element));
      break;
    case silex.model.Element.TYPE_IMAGE:
      // TODO: allow multiple files
      this.view.fileExplorer.openFile(
        blob => {
          // load the image
          this.model.element.setImageUrl(element, blob.url);
        },
        { 'mimetypes': ['image/jpeg', 'image/png', 'image/gif'] },
        error => {
            silex.utils.Notification.notifyError('Error: I did not manage to load the image. \n' + (error.message || ''));
          }
      );
      break;
  }
};


/**
 * get the index of the element in the DOM
 * @param {Element} element
 * @return {number}
 */
silex.controller.EditMenuController.prototype.indexOfElement = function(element) {
  let len = element.parentNode.childNodes.length;
  for (let idx = 0; idx < len; idx++) {
    if (element.parentNode.childNodes[idx] === element) {
      return idx;
    }
  }
  return -1;
};


/**
 * Move the selected elements in the DOM
 * This will move its over or under other elements if the z-index CSS properties are not set
 * @param  {silex.model.DomDirection} direction
 */
silex.controller.EditMenuController.prototype.move = function(direction) {
  // undo checkpoint
  this.undoCheckPoint();
  // get the selected elements
  var elements = this.model.body.getSelection();
  // sort the array
  elements.sort((a, b) => {
    return this.indexOfElement(a) - this.indexOfElement(b);
  });
  // move up
  elements.forEach((element) => {
    let reverse = this.model.element.getStyle(element, 'position', true) !== 'absolute';
    if(reverse) {
      switch(direction) {
        case silex.model.DomDirection.UP:
          direction = silex.model.DomDirection.DOWN;
          break;
        case silex.model.DomDirection.DOWN:
          direction = silex.model.DomDirection.UP;
          break;
        case silex.model.DomDirection.TOP:
          direction = silex.model.DomDirection.BOTTOM;
          break;
        case silex.model.DomDirection.BOTTOM:
          direction = silex.model.DomDirection.TOP;
          break;
      }
    }
    this.model.element.move(element, direction);
  });
};


/**
 * Move the selected elements in the DOM
 * This will move its over or under other elements if the z-index CSS properties are not set
 */
silex.controller.EditMenuController.prototype.moveUp = function() {
  this.move(silex.model.DomDirection.UP);
};


/**
 * Move the selected elements in the DOM
 * This will move its over or under other elements if the z-index CSS properties are not set
 */
silex.controller.EditMenuController.prototype.moveDown = function() {
  this.move(silex.model.DomDirection.DOWN);
};


/**
 * Move the selected elements in the DOM
 * This will move its over or under other elements if the z-index CSS properties are not set
 */
silex.controller.EditMenuController.prototype.moveToTop = function() {
  this.move(silex.model.DomDirection.TOP);
};


/**
 * Move the selected elements in the DOM
 * This will move its over or under other elements if the z-index CSS properties are not set
 */
silex.controller.EditMenuController.prototype.moveToBottom = function() {
  this.move(silex.model.DomDirection.BOTTOM);
};
