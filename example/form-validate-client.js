var ValidatorClient = function (container) {
    this.container = container || document;
    this.validator = new Validator(this.container);
    this.init(this.container);
};

ValidatorClient.prototype = {
    init: function (container) {
        var self = this;
        $(container).on("validation.onElementValidation", function (e, data) {
            var validatorName;
            for (validatorName in data.result) {
                if (!data.result.hasOwnProperty(validatorName)) {
                    continue;
                }
                var validatorStatus = data.result[validatorName];
                if (validatorStatus) {
                    continue;
                }
                self.displayError(data.element);
            }
        });

        $(container).on("validation.onFormValidation", function (e, data) {
            if (self.isFormValid(data)) {
                HTMLFormElement.prototype.submit.call(data.form);
            } else {
                alert(self.getFormErrorMessage(data));
            }
        });

        $(container).on('focusin', "input[type=text]", function () {
            self.removeError(this);
        });

        $(container).on('change', "select", function () {
            self.removeError(this);
        });

    },
    displayError: function (element) {
        $(element).addClass("form-error");
    },
    removeError: function (element) {
        $(element).removeClass("form-error");
    },
    getFormErrorMessage: function (data) {

        function getError(data) {
            var id = data.element.getAttribute('id');
            var name = data.element.getAttribute('name');
            var label = $('label[for="'+id+'"]');
            if (label.length) {
                name = label.text().trim().replace('*','');
            } else if (label = data.element.getAttribute('data-validators-label')) {
                name = label;
            }
            for (var validator in data.result) {
                if (data.result.hasOwnProperty(validator)) {
                    if (data.result[validator]) {
                        continue;
                    }
                    if (validator == 'required' || validator == 'radio') {
                        return name + ' is required';
                    }
                    else {
                        return name + ' is not valid';
                    }
                }
            }
            return null;
        }

        var errors = "";
        for (var i = 0; i < data.result.length; i += 1) {
            var error = getError(data.result[i]);
            if (error) {
                errors += error + "\n";
            }
        }
        return errors;
    },
    isFormValid: function (data) {
        for (var i = 0; i < data.result.length; i += 1) {
            var validatorResult = data.result[i].result;
            for (var validatorName in validatorResult) {
                if (validatorResult.hasOwnProperty(validatorName)) {
                    if (!validatorResult[validatorName]) {
                        return false;
                    }
                }
            }
        }
        return true;
    }
};
