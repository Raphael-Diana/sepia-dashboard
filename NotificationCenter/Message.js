const NOISE_THRESHOLD = 1; //
const CONSULTATION_ANSWER_THRESHOLD = .5;//

const titleEnum = {
    PROACTIVE_ASSISTANCE_NOT_FINISHED : "Guidage : abandon avant la fin",
    PROACTIVE_ASSISTANCE_MORE_ACTION : "Guidage : plus d'action que la moyenne",
    CONSULTATION_ANSWER_MAJORITY : "Consultation utilisateur : choix majoritaire",
    ASSISTANCE_LACK : "Fenêtre sans règle d'assistance associée"
};

const messageContentEnum = {
    TRIGGER_STATS : ["", "a abandonné le guidage avent la fin"],
    PROACTIVE_ASSISTANCE : "proactiveAssistanceFollowup",
    CONSULTATION_ANSWER : "consultationAnswerStats",
    SYSTEM_SIGNAL : "systemSignals",
    USE_RATE : "useRate"
}

function publishMessage(title, content) {
    var notifCenter = document.getElementById("notificationCenter");
    var button = document.createElement("button");
    button.setAttribute("class", "accordion");
    button.innerHTML = title;
    button.onclick = function() {
        this.classList.toggle("active");
        var panel = this.nextElementSibling;
        if (panel.style.maxHeight){
            panel.style.maxHeight = null;
        } else {
            panel.style.maxHeight = panel.scrollHeight + "px";
        }
    };
    var div = document.createElement("div");
    div.setAttribute("class", "panel");
    var p = document.createElement("p");
    p.innerHTML = content;
    div.appendChild(p);
    notifCenter.appendChild(button);
    notifCenter.appendChild(div);

}

/**
 * Create message for the user who do more action or didn't finish the task
 * @param URL
 */
function proactiveMessage(URL) {
    // TODO trace the info
    var numberOfSubStepsBySteps = new Map(); // the max number of sub-steps by steps
    var completedSubStepsByUsers = new Map(); // the number of sub-steps by user
    var noiseByUsers = new Map(); // the number of action by step by user
    var totalNoiseBySubsteps = new Map(); // the total noise by steps
    //get the fusion trace for the user behaviour
    var request = d3.json(URL)
        .on("beforesend", function(request) { request.withCredentials = true; })
        //.mimeType("application/json");
    request.get(function (error, data) {
        if (error) throw error;

        var steps = data.obsels.reduce(function (res, val) {
            var stepNb = val["m:stepNumber"];
            var subStepNb = val["m:subStepNumber"];
            var noise = val["m:noise"];
            var subject = val.subject;
            // compute the max of sub-steps
            if (!res.has(stepNb)) {
                res.set(stepNb, subStepNb);
            }
            else {
                if (res.get(stepNb) < subStepNb)
                    res.set(stepNb, subStepNb);
            }


            // compute the completed sub-steps
            if (!completedSubStepsByUsers.has(subject)){
                var userSteps = new Map();
                userSteps.set(stepNb, subStepNb);
                completedSubStepsByUsers.set(subject,userSteps);
            }
            else {
                var userSteps = completedSubStepsByUsers.get(subject);
                if (!userSteps.has(stepNb)) {
                    userSteps.set(stepNb, subStepNb);
                }
                else {
                    if (userSteps.get(stepNb) < subStepNb)
                        userSteps.set(stepNb, subStepNb);
                }
            }

            //TODO: handle multiple steps
            // compute the noise by sub-steps
            if (!noiseByUsers.has(subject)){
                var userSteps = new Map();
                userSteps.set(subStepNb, noise);
                noiseByUsers.set(subject,userSteps);
            }
            else {
                var userSteps = noiseByUsers.get(subject);
                if (!userSteps.has(subStepNb)) {
                    userSteps.set(subStepNb, noise);
                }
            }

            // compute total noise by steps
            if (!totalNoiseBySubsteps.has(subStepNb)) {
                totalNoiseBySubsteps.set(subStepNb, {total: noise, count:1});
            }
            else {
                totalNoiseBySubsteps.get(subStepNb).total += noise;
                totalNoiseBySubsteps.get(subStepNb).count ++;
            }

            return res;
        }, numberOfSubStepsBySteps);

        var notFinishUser = [];
        //TODO: handle multiple steps
        for (let key of noiseByUsers.keys()) {
            if (noiseByUsers.get(key).size < steps.get(0)) {
                notFinishUser.push(key);
            }
        }

        //compute the average noise by sub-steps
        for (let key of totalNoiseBySubsteps.keys()) {
            var obj = totalNoiseBySubsteps.get(key);
            obj.avg = obj.total / obj.count;
        }


        //TODO: group all the message by category
        for (var i = 0; i < notFinishUser.length; i++) {
            var content = notFinishUser[i] + " a abandonné le guidage pas à pas avant la fin (" + noiseByUsers.get(notFinishUser[i]).size + "/" + steps.get(0) + ").";
            publishMessage(titleEnum.PROACTIVE_ASSISTANCE_NOT_FINISHED, content);
        }

        var userNoiseOffset = new Map();

        for (let user of noiseByUsers) {

            for (let step of user[1]) {
                var key = step[0];
                var noise = user[1].get(key);
                if (!userNoiseOffset.has(user[0])) {
                    userNoiseOffset.set(user[0], noise - totalNoiseBySubsteps.get(key).avg);
                }
                else {
                    userNoiseOffset.set(user[0], userNoiseOffset.get(user[0]) +  noise - totalNoiseBySubsteps.get(key).avg);
                }
            }
        }

        for (let user of userNoiseOffset) {
            var key = user[0];
            userNoiseOffset.set(key, userNoiseOffset.get(key) / noiseByUsers.get(key).size);
        }

        var userAboveNoiseThreshold = [];
        for (let user of userNoiseOffset) {
            var key = user[0];
            var value = user[1];

            if (value > NOISE_THRESHOLD) {
                userAboveNoiseThreshold.push(key);
            }
        }

        for (var i = 0; i < userAboveNoiseThreshold.length; i++) {
            var user = userAboveNoiseThreshold[i];
            var content = "En moyenne, " + user + " fait " + userNoiseOffset.get(user).toFixed(3) + " actions de plus que les autres avant de suivre les suggestions de l'assistance";
            publishMessage(titleEnum.PROACTIVE_ASSISTANCE_MORE_ACTION, content);
        }


    });

}

function consultationAnswerMessage(URL) {
    var request = d3.json(URL)
        .on("beforesend", function(request) { request.withCredentials = true; });
    //.mimeType("application/json");

    request.get(function (error, data) {
        if (error) throw error;

        var tidyData = d3.nest()
            .key(function (d) {
                return d['m:sourceId'];
            })
            .key(function (d) {
                return d['m:value'];
            })
            .key(function (d) {
                return d.subject;
            })
            .rollup(function (d) {
                // only one obsel by subject
                return d[0]['m:occurence'];
            })
            .object(data.obsels);


        //TODO: set the threshold to the optimal repartition function of the number of choices
        var answerOverThreshold = [];
        for (let id in tidyData) {
            var maxAnswerCount = 0;
            var maxAnswer;
            var totalAnswer = 0;
            var consultation = tidyData[id];
            for (let answer in consultation) {
                var sum = d3.sum(Object.values(consultation[answer]), function (d) {
                    return d;
                });
                if (sum > maxAnswerCount) {
                    maxAnswerCount = sum;
                    maxAnswer = answer;
                }
                totalAnswer += sum;
            }
            if (maxAnswerCount / totalAnswer >= CONSULTATION_ANSWER_THRESHOLD)
                answerOverThreshold.push({id: id, answer: maxAnswer, ratio: maxAnswerCount / totalAnswer});
        };

        for (var i = 0; i < answerOverThreshold.length; i++) {
            var obj = answerOverThreshold[i];
            var content = "Le choix \"" + obj.answer + "\" a été répondu dans " + (obj.ratio * 100).toFixed(1) + "% des cas à la consultation " + obj.id + ".";
            publishMessage(titleEnum.CONSULTATION_ANSWER_MAJORITY, content);
        }

    });
};

function assistanceLackMessage(signals_URL) {
    var signalsRequest = d3.json(signals_URL)
        .on("beforesend", function(request) { request.withCredentials = true; });

    signalsRequest.get(function (error, signalsTraceJSON) {
        if (error) throw error;


        var componentByWindows = new Map();
        var rulesByWindows = new Map();
        var assistedWindows = [];

        // map component to windows
        d3.xml(interfaceDescription, function (error, xml) {
            if (error) throw error;

            var windows = d3.select(xml).selectAll("fenetre").each(function () {
                var windowDescr = this.attributes.descriptionAjoutee.nodeValue;
                d3.select(this).selectAll("composant").each(function () {
                    componentByWindows.set(this.id, windowDescr);
                })
            });

            var signalCategories = [];

            var signalsByWindows = d3.nest()
                .key(function (d) {
                    return componentByWindows.get(d["m:sourceId"]);
                })
                .key(function (d) {
                    var category = d["m:signalType"]["@id"];
                    if (!signalCategories.includes(category))
                        signalCategories.push(category);
                    return category;
                })
                .object(signalsTraceJSON.obsels);


                // map rules to windows
                d3.xml(assistanceDescription, function (error, xml) {
                    if (error) throw error;

                    d3.select(xml).selectAll("regle")
                        .each(function () {
                            //map each component to its parent
                            var ruleId = this.attributes.id.nodeValue;
                            var eventNode = d3.select(this).select("evenement_declencheur")._groups[0][0];
                            var eventType = eventNode.attributes.type.nodeValue;
                            var componentId = eventNode.attributes.idComp.nodeValue;

                            if (!eventType.startsWith("smt_")) {
                                rulesByWindows.set(ruleId, componentByWindows.get(componentId));
                                assistedWindows.push(componentByWindows.get(componentId));
                            }
                            else {
                                //TODO: trace more context for system signal
                                //TODO: warning two message content can be the same
                                loop1:
                                for (let window in signalsByWindows) {
                                    if (signalsByWindows[window].hasOwnProperty("m:" + eventType)) {
                                        loop2:
                                        for (var i = 0; i < signalsByWindows[window]["m:" + eventType].length; i++) {
                                            if (signalsByWindows[window]["m:" + eventType][i]["m:message"] == componentId) {
                                                rulesByWindows.set(ruleId, componentByWindows.get(signalsByWindows[window]["m:" + eventType][i]["m:sourceId"]));
                                                assistedWindows.push(componentByWindows.get(signalsByWindows[window]["m:" + eventType][i]["m:sourceId"]));
                                                break loop1;
                                            }
                                        }
                                    }
                                }
                            }
                        });

                    var windowsWithErrorWithoutRules = [];
                    for (let window in signalsByWindows) {
                        if (signalsByWindows[window].hasOwnProperty("m:smt_Error") && !assistedWindows.includes(window)) {
                            windowsWithErrorWithoutRules.push(window);
                        }
                    }

                    for (var i = 0; i < windowsWithErrorWithoutRules.length; i ++) {
                        var content = "La fenêtre \"" + windowsWithErrorWithoutRules[i] + "\" génère "
                            + signalsByWindows[windowsWithErrorWithoutRules[i]]["m:smt_Error"].length + " erreur(s)"
                            + " mais n'a aucune règle d'assistance associée.";

                        publishMessage(titleEnum.ASSISTANCE_LACK, content);
                    }
                });

        });

    });

}
