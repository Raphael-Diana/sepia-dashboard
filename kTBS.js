/**
 * Created by raphael on 30/04/2017.
 */

/**
 * 1 - apply a transformation to all user traces
 * 2 - fusion all the computed traces
 * 3 - filter the traces and fusion
 */
var targetAppName;

const transformationEnum = {
    TRIGGER_STATS : "rulesAndActionsTriggerStats",
    PROACTIVE_ASSISTANCE : "proactiveAssistanceFollowup",
    CONSULTATION_ANSWER : "consultationAnswerStats",
    SYSTEM_SIGNAL : "systemSignals",
    USE_RATE : "useRate"
}

const ruleAndActionTriggerStatsFile = "Methods/rulesAndActionsTriggerStats.rq";
const proactiveAssistanceFollowupFile = "Methods/proactiveAssistanceFollowup.fsa";
const consultationAnswerStatsFile = "Methods/consultationAnswerStats.rq";
const systemSignalsFile = "Methods/systemSignals.json";
const useRateFile = "Methods/useRate.rq";

function getComputedTraceFile(transformationType) {
    switch (transformationType) {
        case transformationEnum.TRIGGER_STATS:
            return ruleAndActionTriggerStatsFile;
        case transformationEnum.CONSULTATION_ANSWER:
            return consultationAnswerStatsFile
        case transformationEnum.PROACTIVE_ASSISTANCE:
            return proactiveAssistanceFollowupFile;
        case transformationEnum.SYSTEM_SIGNAL:
            return systemSignalsFile;
        case transformationEnum.USE_RATE:
            return useRateFile;
        default :
            throw new Error("Type de transformation inconnu : " + transformationType);
            return null;
    }
}

function getComputedTraceMethodName(transformationType) {
    switch (transformationType) {
        case transformationEnum.TRIGGER_STATS:
        case transformationEnum.CONSULTATION_ANSWER:
            return "sparql";
        case transformationEnum.PROACTIVE_ASSISTANCE:
        case transformationEnum.SYSTEM_SIGNAL:
            return "fsa";
        case transformationEnum.USE_RATE:
            return "filter";
        default :
            return null;
    }
}

function getComputedTraceParameterName(transformationType) {
    switch (transformationType) {
        case transformationEnum.TRIGGER_STATS:
        case transformationEnum.CONSULTATION_ANSWER:
            return "sparql";
        case transformationEnum.PROACTIVE_ASSISTANCE:
        case transformationEnum.SYSTEM_SIGNAL:
            return "fsa";
        case transformationEnum.USE_RATE:
            return "bgp";
        default :
            return null;
    }
}


/**
 * Check if a resource exists
 * @param url
 * @returns {boolean}
 */
function isResourceExists(url){

    var http = new XMLHttpRequest();
    http.withCredentials = true;
    http.open('HEAD', url, false);
    http.send();

    return http.status != 404;

}

/**
 * Retrieves the users names from the stored traces
 * @param error
 * @param data
 * @returns {Set} the users names
 */
function getUserNames(data) {

    var userNames = new Set();
    data.contains.forEach(function (d) {
        // check only the stored traces
        if (d["@type"] == "StoredTrace") {
            // get the user name
            var id = d["@id"];
            //var userName = id.replace(targetAppName + '_', '');
            //userName = userName.substring(userName.indexOf('_'));

            userNames.add(id.substring(0, id.lastIndexOf('/')));
        }
    });

    return userNames;
}

/**
 * Create computed trace for each user in the base and the fusion trace
 * @param baseURL the URL of the base
 * @param transformationType the type of the transformation
 */
function createComputedTraces(baseURL, transformationType) {
    // get the base content
    JSONrequest(baseURL)
        .send("GET", function (error, data) {
            if (error) throw error;

            // 1 - Get the user names
            var userNames = getUserNames(data);
            console.log(userNames);

            // for each user create the transformation trace
            for (let username of userNames.values()) {
                // check if the computed trace already exists
                var id = transformationType + '_' + username + "/";
                var traceUrl = baseURL + id;

                var exists = isResourceExists(traceUrl);
                console.log("is resource " + traceUrl + " exists " + exists);
                // 2 - Create the computed traces
                if (!exists) {
                    // create the JSON object representing the computed trace
                    var computedTrace = {};
                    computedTrace["@id"] = id;
                    computedTrace["@type"] = "ComputedTrace";
                    computedTrace.hasMethod = getComputedTraceMethodName(transformationType);
                    computedTrace.hasSource = [];
                    computedTrace.hasSource.push(username + "/");
                    computedTrace.parameter = [];

                    // read the data file corresponding to the transformation
                    d3.text(getComputedTraceFile(transformationType), function (error, data) {
                        if (error) throw error;

                        computedTrace.parameter.push(getComputedTraceParameterName(transformationType) + '=' + data.replace(/\r?\n|\r/g, " "));

                        console.log(computedTrace);

                        // 3 - POST the computed trace
                        JSONrequest(baseURL)
                            .send("POST", JSON.stringify(computedTrace), function (error, data) {
                                if (error) throw error;

                                console.log(data);
                            });
                    });


                }
            }

            // 4 - Create the fusion trace
            var fusionExists = isResourceExists(baseURL + "fusion_" + transformationType + "_all/");
            if (!fusionExists) {
                console.log("Fusion does not exists");
                var fusion = {};
                fusion["@id"] = "fusion_" + transformationType + "_all/";
                fusion["@type"] = "ComputedTrace";
                fusion.hasMethod = "fusion";
                fusion.hasSource = [];
                for (let username of userNames.values()) {
                    fusion.hasSource.push(transformationType + '_' + username + '/');
                }

                // POST the fusion trace
                JSONrequest(baseURL)
                    .send("POST", JSON.stringify(fusion), function (error, data) {
                        if (error) throw error;

                        console.log(data);
                    });
            }
            else {
                // update the sources
                console.log("Fusion does exists");

                var eTag;

                JSONrequest(baseURL + "fusion_" + transformationType + "_all/")
                    .response(function(xhr) { eTag = xhr.getResponseHeader("Etag"); return JSON.parse(xhr.responseText); })
                    .send("GET", function (error, data) {
                        if (error) throw error;

                        data.hasSource = [];
                        for (let username of userNames.values()) {
                            data.hasSource.push("../" + transformationType + '_' + username + '/');
                        }

                        JSONrequest(baseURL + "fusion_" + transformationType + "_all/")
                            .header("if-match", eTag)
                            .header("Content-Type", "application/json")
                            .send("PUT", JSON.stringify(data));

                    });
            }
        });


}


/**
 * Create a JSON request
 * @param URL the URL where to send the request
 * @returns {*} a request object
 * @constructor
 */
function JSONrequest(URL) {
    return d3.json(URL)
        .on("beforesend", function(request) { request.withCredentials = true; })
        .mimeType("application/json")
        .header("Content-Type", "application/json");
}

