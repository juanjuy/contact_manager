class Controller {
  constructor(model, view) {
    this.model = model;
    this.view = view;
    this.updateContactsList();

    this.view.bindSearchInput(this.handleSearchInput.bind(this));
    this.view.bindTagClick(this.handleTagClick.bind(this));
    this.view.bindResetClick(this.handleResetClick.bind(this));
    this.view.bindSubmit(this.handleSubmitCreation.bind(this), this.handleSubmitUpdate.bind(this));
    this.view.bindDeleteClick(this.handleDeleteClick.bind(this));
  }

  async updateContactsList() {
    let contacts = await this.model.retrieveAllContacts();
    this.view.renderContacts(contacts);
    let tags = this.model.getTagList();
    this.view.renderTagList(tags);
  }

  handleSearchInput(value) {
    let searchResults = this.model.searchContactsByName(value);
    if (searchResults.length > 0) {
      this.view.renderContacts(searchResults);
    } else {
      this.view.renderNoMatches(value);
    }
  }

  handleTagClick(value) {
    let contacts = this.model.searchContactsByTag(value);
    this.view.renderContacts(contacts);
  }

  handleResetClick() {
    this.view.renderContacts(this.model.contacts);
  }

  async handleSubmitCreation(data) {
    await this.model.createContact(data);
    await this.updateContactsList();
  }

  async handleSubmitUpdate(data, dataId) {
    await this.model.updateContact(data, dataId);
    await this.updateContactsList();
  }

  async handleDeleteClick(id) {
    await this.model.deleteContact(id);
    await this.updateContactsList();
  }
}

class Model {
  constructor() {
    this.contacts = [];
  }

  async retrieveAllContacts() {
    let request = await fetch('/api/contacts');
    let contacts = await request.json();
    this.convertTagsToArray(contacts);
    this.contacts = contacts;
    return contacts;
  }

  convertTagsToArray(contacts) {
    contacts.forEach(contact => {
      if (contact.tags) {
        contact.tags = contact.tags.split(',');
      } else {
        contact.tags = [];
      }
    });
  }

  searchContactsByName(value) {
    return this.contacts.filter(contact => {
      return contact.full_name.toLowerCase().includes(value);
    });
  }

  getTagList() {
    let tagList = [];
    this.contacts.forEach(contact => {
      contact.tags.forEach(tag => {
        if (!tagList.includes(tag)) {
          tagList.push(tag);
        }
      });
    });

    return tagList;
  }

  searchContactsByTag(value) {
    return this.contacts.filter(contact => {
      return contact.tags.includes(value);
    });
  }

  async createContact(data) {
    data = this.cleanupFormData(data);
    await fetch('/api/contacts', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { "content-type": "application/json" }
    });
  }

  async deleteContact(id) {
    await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
  }

  async updateContact(data, dataId) {
    data = this.cleanupFormData(data);
    data.id = dataId;

    await fetch(`/api/contacts/${dataId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: { "content-type": "application/json" }
    });
  }

  cleanupFormData(data) {
    let obj = {};

    data.forEach(field => {
      obj[field.name] = field.value;
    });

    return obj;
  }
}

class View {
  constructor() {
    this.$contacts = $('#contacts');
    this.$search = $('#search');
    this.$tagList = $('#tagList');
    this.$main = $('main');
    this.$reset = $('#reset');
    this.$contactFormPage = $('#contactFormPage');
    this.$contactFormPageH1 = $('#contactFormPage h1');
    this.$contactFormPage.hide();
    this.$contactForm = $('#contactForm');

    this.contactTemplate = Handlebars.compile($('#contactTemplate').html());
    this.noContactTemplate = Handlebars.compile($('#noContactTemplate').html());
    this.noMatchesTemplate = Handlebars.compile($('#noMatchesTemplate').html());

    this.addCreateContactListener();
    this.addCancelButtonListener();
    this.addEditButtonListener();
  }

  renderContacts(contactArray) {
    if (contactArray.length > 0) {
      this.$contacts.html(this.contactTemplate({contacts: contactArray}));
    } else {
      this.$contacts.html(this.noContactTemplate());
    }
  }

  renderTagList(tags) {
    this.$tagList.empty();

    tags.forEach(tag => {
      let $button = $(document.createElement('button'));
      $button.addClass('tag');
      $button.text(tag);
      this.$tagList.append($button);
    });
  }

  renderNoMatches(value) {
    this.$contacts.html(this.noMatchesTemplate(value));
  }

  bindSearchInput(handler) {
    this.$search.on('input', event => {
      let value = $(event.target).val().toLowerCase();
      handler(value);
    });
  }

  bindTagClick(handler) {
    this.$main.on('click', '.tag', event => {
      let value = $(event.target).text();
      handler(value);
    });
  }

  bindResetClick(handler) {
    this.$reset.on('click', () => {
      handler();
    });
  }

  addCreateContactListener() {
    this.$main.on('click', '.add', () => {
      this.$main.hide();
      this.$contactForm.removeAttr('data-updateid');
      this.$contactFormPageH1.text('Add Contact');
      this.$contactFormPage.show();
      this.$contactForm.trigger('reset');
    });
  }

  addCancelButtonListener() {
    this.$contactFormPage.on('click', '.cancel', event => {
      event.preventDefault();
      this.$main.show();
      this.$contactFormPage.hide();
    });
  }

  addEditButtonListener() {
    this.$main.on('click', '.edit', event => {
      let id = $(event.target).attr('data-id');
      this.$main.hide();
      this.$contactForm.attr('data-updateid', id);
      this.$contactFormPageH1.text('Edit Contact');
      this.$contactFormPage.show();
      this.$contactForm.trigger('reset');
      this.fillFields(id);
    });
  }

  bindSubmit(addHandler, updateHandler) {
    let view = this;
    this.$contactForm.on('submit', async function(event) {
      event.preventDefault();

      let data = $(this).serializeArray();
      let updateId = view.$contactForm.attr('data-updateid');
      if (view.formFieldsValid(data)) {
        if (!updateId) {
          await addHandler(data);
          view.$main.show();
          view.$contactFormPage.hide();
        } else {
          await updateHandler(data, updateId);
          view.$main.show();
          view.$contactFormPage.hide();
        }
      }
    });
  }

  bindDeleteClick(handler) {
    this.$main.on('click', '.delete', event => {
      if (confirm('Are you sure you want to delete this contact?')) {
        let id = $(event.target).attr('data-id');
        handler(id);
      }
    });
  }

  formFieldsValid(data) {
    this.resetInvalidFields();

    let invalidFields = [];

    data.forEach(obj => {
      if (obj.name !== 'tags') {
        if (obj.value.trim().length === 0) {
          invalidFields.push(obj.name);
        }
      }
    });

    if (invalidFields.length > 0) {
      invalidFields.forEach(field => {
        let $input = $(`input[name=${field}]`);
        this.markInvalidField($input);
      });
    }

    return invalidFields.length === 0;
  }

  markInvalidField($field) {
    $field.addClass('invalid');
    $field.nextAll('.validation').css('display', 'inline');
  }

  resetInvalidFields() {
    $('.invalid').removeClass('invalid');
    $('.validation').hide();
  }

  fillFields(id) {
    let contactInfo = this.extractFromContactDiv(id);
    this.$contactForm.find('[name="full_name"]').val(contactInfo.fullName);
    this.$contactForm.find('[name="email"]').val(contactInfo.email);
    this.$contactForm.find('[name="phone_number"]').val(contactInfo.phoneNumber);
    this.$contactForm.find('[name="tags"]').val(contactInfo.tags);
  }

  extractFromContactDiv(id) {
    let $contact = $(`[data-id=${id}]`);
    let obj = {
      fullName: '',
      email: '',
      phoneNumber: '',
      tags: ''
    };

    obj.fullName = $contact.find('h2').text();
    obj.email = $contact.find('.email').text();
    obj.phoneNumber = $contact.find('.phone_number').text();

    let $tags = $contact.find('.tag');
    let tags = [];
    for (let tag of $tags) {
      tags.push(tag.textContent);
    }

    tags = tags.join(',');

    obj.tags = tags;
    return obj;
  }
}

$(function() {
  const app = new Controller(new Model(), new View());
});