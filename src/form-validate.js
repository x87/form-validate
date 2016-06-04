class Validator {

    constructor(container) {
        this.rules = {};
        this.init(container || document);
    };

    static get utils() {
        return (function ($) {
            return {
                removeValidator: function (element, validatorName) {
                    let validators = $(element).attr("data-validators");
                    if (!validators) return;
                    $(element).attr("data-validators", validators.replace(new RegExp('\\s', 'g'), '').split(',').filter(function (v) {
                        return v != validatorName;
                    }).join(","));
                },
                addValidator: function (element, validatorName) {
                    let validators = $(element).attr("data-validators");
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
                    $(element).on(event, callback);
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
                            data: data,
                            contentType: 'application/json'
                        }
                    );
                },
                when: function () {
                    return $.when.apply($, [].slice.call(arguments));
                }
            }
        })(jQuery)
    }

    init(container) {
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
                pattern: "^[\\d]*$"
            },
            "zip": {
                pattern: "^([\\d\\sa-zA-Z_\\.!-]*)([\\da-zA-Z]+)([\\d\\sa-zA-Z_\\.!-]*)$"
            },
            "minlen": function (value, name, element) {
                let len = Number(name.split('-').pop());
                return len && value.length >= len;
            },
            "maxlen": function (value, name, element) {
                let len = Number(name.split('-').pop());
                return len && value.length <= len;
            },
            "except": function (value, name, element) {
                let chars = name.split('-').pop();
                if (!chars) return false;
                chars = "\\" + chars.split('').join("\\");
                return !(new RegExp("[" + chars + "]+")).test(value);
            },
            "only": function (value, name, element) {
                let chars = name.split('-').pop();
                if (!chars) return false;
                chars = "\\" + chars.split('').join("\\");
                return (new RegExp("^[" + chars + "]+$")).test(value);
            },
            "radio" : function (value, name, element) {
                var elementName = element.name || "";
                if (!elementName) return element.checked;
                var elements = Validator.utils.getElements(container, "[name='" + elementName + "']:checked");
                return elements.length > 0;
            }
        });

        let elements = Validator.utils.getElements(container, "[data-validators]");
        elements.forEach(element => {

            let validators = element.getAttribute("data-validators");
            if (~['submit'].indexOf(validators)) {

                let $form = $(element).parents('form');
                if (!$form.length) {
                    return;
                }

                let callback = ((form, submit) => (event) => {
                    event.preventDefault();
                    this.onSubmit(form, submit, container);
                })($form[0], element);

                Validator.utils.attachListener(element, "click", callback);

            } else {
                this.attachValidator(element, "focusout", (result) => {
                    if (result) {
                        Validator.utils.trigger("validation.onElementValidation", result, container);
                    }
                });
            }
        })
    }

    onSubmit(form, submit, container) {
        this.validateForm(form).then(function () {
            let args = [].slice.call(arguments);
            let validators = submit.getAttribute("data-validators");
            if (!validators) {
                return false;
            }

            args.forEach(function (arg) {
                Validator.utils.trigger("validation.onElementValidation", arg, container);
            });
            Validator.utils.trigger("validation.onFormValidation", {form: form, result: args}, container);
        });
        return false;
    }

    attachValidator(element, event, cb) {
        Validator.utils.attachListener(element, event, () => {
            this.validateElement(element).then(cb)
        });
    }

    validateElement(element) {
        let validatorString = (element.getAttribute("data-validators") || "");
        if (!validatorString.trim().length) {
            return Validator.utils.when();
        }
        let i = 0,
            validators = validatorString.replace(new RegExp('\\s', 'g'), '').split(','),
            queueLen = validators.length;

        let next = (result) => {
            let ruleName = validators[i].split('-').shift();

            if (!this.rules[ruleName]) {
                return (++i >= queueLen) ? Validator.utils.when(result) : next(result)
            }

            return this.rules[ruleName].call(this, element.value, validators[i], element)
                .then(function (success) {
                    result[ruleName] = success;
                    return (!success || (++i >= queueLen)) ? Validator.utils.when(result) : next(result);
                })
        };

        return next({}).then(result => ({
                element: element,
                result: result
            })
        )
    }

    validateForm(container) {
        let elements = Validator.utils.getElements(container, "[data-validators]");
        let requests = elements.map(element => {

            let validators = element.getAttribute("data-validators");
            if (!validators) {
                return null;
            }
            if (~['submit'].indexOf(validators)) {
                return null;
            }
            return this.validateElement(element);
        }).filter(element => element);
        return Validator.utils.when.apply(null, requests)
    }

    addRule(name, validator) {
        class PatternValidator {
            constructor(config) {
                let regEx = new RegExp(config.pattern, "i");
                return (value, name, element) => Validator.utils.when(regEx.test(value));
            }
        }

        class AjaxValidator {
            constructor(config) {
                let request = null;
                return function (value, name, element) {
                    const data = {
                        [config.ajax.param]: value
                    };
                    if (request && typeof request.abort == 'function') {
                        request.abort();
                    }
                    // todo: remove $ dependency
                    let defer = $.Deferred();
                    request = Validator.utils.ajax(config.ajax.url, data, config.ajax.method || "POST");
                    request.then(function (response) {
                        defer.resolve(response.success);
                        request = null;
                    }).fail(function (e, status) {
                        if (status == 'abort') {
                            defer.reject();
                        } else {
                            defer.resolve(false);
                        }
                        request = null;
                    });
                    return defer.promise();
                }
            };
        }

        if (typeof validator == 'function') {
            this.rules[name] = (value, name, element) => Validator.utils.when(validator(value, name, element))
        } else if (validator.pattern) {
            this.rules[name] = new PatternValidator(validator);
        } else if (validator.ajax) {
            this.rules[name] = new AjaxValidator(validator);
        }
    }

    addRules(rules) {
        for (let rule in rules) {
            if (rules.hasOwnProperty(rule)) {
                this.addRule(rule, rules[rule])
            }
        }
    }
}
