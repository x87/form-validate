var Validator = function (container) {
    this.rules = {};
    this.init(container || document);
};

Validator.utils = (function ($) {
    return {
        removeValidator: function (element, validatorName) {
            var validators = $(element).attr("data-validators");
            if (!validators) return;
            $(element).attr("data-validators", validators.replace(new RegExp('\\s', 'g'), '').split(',').filter(function (v) {
                return v != validatorName;
            }).join(","));
        },
        addValidator: function (element, validatorName) {
            var validators = $(element).attr("data-validators");
            if (validators) {
                validators = validators.replace(new RegExp('\\s', 'g'), '').split(',').filter(function (v) {
                    return v != validatorName;
                })
            } else {
                validators = [];
            }
            validators.push(validatorName);
            $(element).attr("data-validators", validators.join(","));
        },
        attachListener: function (element, event, callback) {
            return $(element).on(event, callback);
        },
        trigger: function (eventName, eventData, container) {
            $(container || document).trigger(eventName, eventData);
        },
        getElements: function (container, selector) {
            return [].slice.call(container.querySelectorAll(selector))
        },
        ajax: function (url, data, method) {
            return $.ajax({
                    url: url,
                    method: method,
                    data: JSON.stringify(data),
                    contentType: 'application/json'
                }
            );
        },
        when: function () {
            return $.when.apply($, [].slice.call(arguments));
        }
    }
})(jQuery);

Validator.prototype = {

    init: function (container) {
        this.addRules({
            "required": {
                pattern: "\\S"
            },
            "email": {
                pattern: "^(?!.*[\\.-][\\.-])(?!.*--)(\\w+[\\w\\.-]*)@([\\w-]+\\.)+[^\\W_]{2,}$"
            },
            "phone": {
                pattern: "[.0-9-]{6,15}?$"
            },
            "name": {
                pattern: "^([\\d\\sa-zA-Z_\\.!-]*)([\\da-zA-Z]+)([\\d\\sa-zA-Z_\\.!-]*)$"
            },
            "number": {
                pattern: "^[\\d]+$"
            },
            "zip": {
                pattern: "^([\\d\\sa-zA-Z_\\.!-]*)([\\da-zA-Z]+)([\\d\\sa-zA-Z_\\.!-]*)$"
            },
            "minlen" : function(value, name) {
                var len = Number(name.split('-').pop());
                return len && value.length >= len;
            },
            "maxlen" : function(value, name) {
                var len = Number(name.split('-').pop());
                return len && value.length <= len;
            },
            "except" : function (value, name) {
                var chars = name.split('-').pop();
                if (!chars) return false;
                chars = "\\" + chars.split('').join("\\");
                return !(new RegExp("["+chars+"]+")).test(value);
            },
            "only" : function (value, name) {
                var chars = name.split('-').pop();
                if (!chars) return false;
                chars = "\\" + chars.split('').join("\\");
                return (new RegExp("^["+chars+"]+$")).test(value);
            }
        });

        var self = this;
        var elements = Validator.utils.getElements(container, "[data-validators]");
        for (var i = 0; i < elements.length; i += 1) {

            var element = elements[i];
            var validators = element.getAttribute("data-validators");
            if (~['submit'].indexOf(validators)) {

                var $form = $(element).parents('form');
                if (!$form.length) {
                    continue;
                }

                (function () {
                    var form = $form[0];
                    var submit = element;
                    Validator.utils.attachListener(element, "click", function (event) {
                        event.preventDefault();
                        self.onSubmit(form, submit, container);
                    });
                })();

            } else {
                this.attachValidator(element, "focusout", function (result) {
                    if (result) {
                        Validator.utils.trigger("validation.onElementValidation", result, container);
                    }
                });
            }
        }
    },

    onSubmit: function (form, submit, container) {
        this.validateForm(form).then(function () {
            var args = [].slice.call(arguments);
            var validators = submit.getAttribute("data-validators");
            if (!validators) {
                return false;
            }

            args.forEach(function(arg) {
                Validator.utils.trigger("validation.onElementValidation", arg, container);
            })
            Validator.utils.trigger("validation.onFormValidation", {form: form, result: args}, container);
        });
        return false;
    },

    attachValidator: function (element, event, cb) {
        Validator.utils.attachListener(element, event, () => {
            this.validateElement(element).then(cb)
        });
    },

    validateElement: function (element) {
        var validatorString = (element.getAttribute("data-validators") || "");
        if (!validatorString.trim().length) {
            return Validator.utils.when();
        }
        let i = 0,
            validators = validatorString.replace(new RegExp('\\s', 'g'), '').split(','),
            queueLen = validators.length;

        let next = (result) => {
            let v = validators[i].split('-').shift();
            if (!this.rules[v]) {
                return (++i >= queueLen) ? Validator.utils.when(result) : next(result)
            }

            let value = element.value;

            return this.rules[v].call(this, value, validators[i])
                .then(function (success) {
                    result[v] = success;
                    return (!success || (++i >= queueLen)) ? Validator.utils.when(result) : next(result);
                })
        }

        return next({}).then(result => ({
                element: element,
                result: result
            })
        )
    },

    validateForm: function (container) {
        let elements = Validator.utils.getElements(container, "[data-validators]");
        let requests = elements.map(element => {

            var validators = element.getAttribute("data-validators");
            if (!validators) {
                return null;
            }
            if (~['submit'].indexOf(validators)) {
                return null;
            }
            return this.validateElement(element);
        }).filter(element => element)
        return Validator.utils.when.apply(null, requests)
    },

    addRule: function (name, validator) {
        const patternValidator = function (config) {
            var regEx = new RegExp(config.pattern, "i");
            return (value, name) => Validator.utils.when(regEx.test(value));
        };

        const ajaxValidator = function (config) {
            var request = null;
            return function (value, name) {
                var data = {};
                data[config.ajax.param] = value;
                if (request && typeof request.abort == 'function') {
                    request.abort();
                }
                var defer = $.Deferred();
                request = Validator.utils.ajax(config.ajax.url, data, config.ajax.method || "POST");
                request.then(function (response) {
                    defer.resolve(response.success);
                    request = null;
                }).fail(function () {
                    defer.resolve(false);
                    request = null;
                });
                return defer.promise();
            }
        };

        if (typeof validator == 'function') {
            this.rules[name] = (value, name) => Validator.utils.when(validator(value, name))
        } else if (validator.pattern) {
            this.rules[name] = new patternValidator(validator);
        } else if (validator.ajax) {
            this.rules[name] = new ajaxValidator(validator);
        }
    },

    addRules: function (rules) {
        for (var rule in rules) {
            if (rules.hasOwnProperty(rule)) {
                this.addRule(rule, rules[rule])
            }
        }
    }
};
