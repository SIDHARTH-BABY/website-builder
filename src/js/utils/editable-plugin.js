//////////////////////////////////////////////////
// Silex, live web creation
// http://projects.silexlabs.org/?/silex/
//
// Copyright (c) 2012 Silex Labs
// http://www.silexlabs.org/
//
// Silex is available under the GPL license
// http://www.silexlabs.org/silex/silex-licensing/
//////////////////////////////////////////////////

/**
 * @fileoverview Helper class for common tasks of the editable jquery plugin
 *
 */


goog.provide('silex.utils.EditablePlugin');

/**
 * @constructor
 * @struct
 */
silex.utils.EditablePlugin = function() {
}


silex.utils.EditablePlugin.EDITABLE_CLASS_NAME = 'editable-style';

/**
 * find the first parent wich has the 'editable-style' cdss class
 */
silex.utils.EditablePlugin.getFirstEditableParent = function(element) {
  var child = element;
  // go through all parents untill it is editable
  while (child && child.getAttribute && !$(child).hasClass(silex.utils.EditablePlugin.EDITABLE_CLASS_NAME)) {
    child = child.parentNode;
  }
  // return the first editable element
  if (child && child.getAttribute && $(child).hasClass(silex.utils.EditablePlugin.EDITABLE_CLASS_NAME)) {
    return child;
  }
  else {
    // The component has no editable parent
    // This is the case of the stage
    console.warn('this element has no editable parent', element);
  }
  return element;
};


/**
 * init, activate and remove the "editable" jquery plugin
 */
silex.utils.EditablePlugin.setEditable = function(element, isEditable, opt_isRootDroppableOnly) {
  // activate editable plugin
  if (isEditable) {

    $('.editable-style', element).each(function () {
      // elements
      if (element.getAttribute('data-silex-type') === 'container'){
        $(this).editable();
      }
      else{
        // containers
        $(this).editable({
          isContainer: true
        });
      }
    });

    // handle the root element itself
    if (element.getAttribute('data-silex-type') === 'container'){
      if (opt_isRootDroppableOnly){
        // allow drops only
        $(element).editable({
          isContainer: true,
          isResizable: false,
          isDroppable: true,
          isDraggable: false
        });
      }
      else{
        $(element).editable({
          isContainer: true
        });
      }
    }
    else{
      $(element).editable();
    }
  }
  // activate editable plugin
  else {
    // deactivate editable plugin
    $('.editable-style', element).editable('destroy');

    // handle the element itself
    $(element).editable('destroy');

    // cleanup the dom
    $(element).find('.silex-selected').removeClass('silex-selected');
    $(element).find('.ui-resizable').removeClass('ui-resizable');
    $(element).find('.ui-draggable').removeClass('ui-draggable');
    $(element).find('.ui-droppable').removeClass('ui-droppable');
    $(element).find('[aria-disabled]').removeAttr('aria-disabled');
    $(element).find('.ui-resizable-handle').remove();
  }
};

/**
 * set the html content of an editable  element, i.e. wich has been setEditable(true)
 * @param   {element} element    the editable element, i.e. wich has been setEditable(true)
 * @param   {string} htmlString  the html content to set
 * @param   {boolean} opt_hasChildContainer   if true, set the html into the first child
 */
silex.utils.EditablePlugin.setEditableHtml = function(element, htmlString, opt_isRootDroppableOnly) {
  // unregister jquery plugin
  silex.utils.EditablePlugin.setEditable(element, false, opt_isRootDroppableOnly);

  // set the html content
  element.innerHTML = htmlString;

  // restore editing
  silex.utils.EditablePlugin.setEditable(element, true, opt_isRootDroppableOnly);
};

/**
 * get raw html content from an editable element, i.e. wich has been setEditable(true)
 * @param   {element} element    the editable element, i.e. wich has been setEditable(true)
 * @param   {boolean} opt_hasChildContainer   if true, set the html into the first child
 * @return   {string} the html content without traces of the editable component
 */
silex.utils.EditablePlugin.getEditableHtml = function(element, opt_isRootDroppableOnly) {
  // unregister jquery plugin
  silex.utils.EditablePlugin.setEditable(element, false, opt_isRootDroppableOnly);

  // remove all markup linked to the "editable" jquery plugin
  var cleanContainer = element.cloneNode(true);

  // restore editing
  silex.utils.EditablePlugin.setEditable(element, true, opt_isRootDroppableOnly);

  // return the html content
  return cleanContainer.innerHTML;
};
