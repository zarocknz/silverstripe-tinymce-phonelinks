<?php

/**
 * Class LinkFormExtension
 *
 * Modified the HTML Editor Link Form to allow custom link tpes
 */
class LinkFormExtension extends DataExtension {

    /**
     * Extends the link form.
     *
     * @param  Form   $form
     * @return Form
     */
    public function updateLinkForm(Form $form)
    {
        Requirements::javascript(EDITOR_EXTENSIONS_DIR . "/javascript/linkform.js");

        $fields = $form->Fields();
        $linkType = $fields->dataFieldByName('LinkType');
        $types = $linkType->getSource();

        // Add telephone number type.
        $types['tel'] = 'Telephone number';

        $linkType->setSource($types);

        $fields->insertAfter(
            new TextField('tel',_t('EditorExtensions.TELNUMBER', 'Phone number')),
            'file'
        );

        return $form;
    }
}
