class rulesByWindows {
    constructor(_div) {
        this.div = _div;

        this.margin = {
            top: 15,
            right: 170,
            bottom: 40,
            left: 50
        };

        this.width = 600 - this.margin.left - this.margin.right;
        this.height = 300 - this.margin.top - this.margin.bottom;

        //this.width = document.getElementById(this.div).offsetWidth - this.margin.left - this.margin.right;
        //this.height = document.getElementById(this.div).offsetHeight - this.margin.top - this.margin.bottom;

        this.titleDiv = d3.select('#' + _div)
            .append('div')
            .attr('class', 'title');

        this.graphicArea = d3.select('#' + _div)
            .append("svg")
            .attr("id", "ruleByWindowsContent")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom);

        // set up principal svg element
        this.svg = this.graphicArea
            .append("g")
            .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

        this.tool_tip = d3.tip()
            .attr("class", "d3-tip")
            .offset([-8, 0]);

        // define the scale
        this.rightScale = d3.scalePoint()
            .range([this.height, 0])
            .padding(.5);

        this.leftScale = d3.scalePoint()
            .range([this.height, 0])
            .padding(.5);

        // define the axis
        this.rightAxis = d3.axisRight(this.rightScale);
        this.leftAxis = d3.axisLeft(this.leftScale);

        this.itemMenu = new Map();
    }

    draw(signals_URL) {
        var oThis = this;

        this.titleDiv
            .style("text-align", "center")
            .append("h4")
            .text("Assistance et " + targetAppName + " : Règles d'assistance associées aux fenêtres");

        var signalsRequest = d3.json(signals_URL)
            .on("beforesend", function (request) {
                request.withCredentials = true;
            });

        signalsRequest.get(function (error, signalsTraceJSON) {
            if (error) console.error(error);


            var componentByWindows = new Map();
            var rulesByWindows = new Map();
            var assistedWindows = [];
            var rules = [];

            // map component to windows
            d3.xml(interfaceDescription, function (error, xml) {
                if (error) console.error(error);

                var windows = d3.select(xml).selectAll("fenetre").each(function () {
                    var windowDescr = this.attributes.descriptionAjoutee.nodeValue;
                    d3.select(this).selectAll("composant").each(function () {
                        componentByWindows.set(this.id, windowDescr);
                    })
                });

                var signalCategories = [];
                var signalEmittingWindows = [];

                var signalsByWindows = d3.nest()
                    .key(function (d) {
                        var window = componentByWindows.get(d["m:sourceId"]);
                        if (!signalEmittingWindows.includes(window))
                            signalEmittingWindows.push(window);
                        return window;
                    })
                    .key(function (d) {
                        var category = d["m:signalType"]["@id"];
                        if (!signalCategories.includes(category))
                            signalCategories.push(category);
                        return category;
                    })
                    .object(signalsTraceJSON.obsels);

                signalEmittingWindows.sort();

                //TODO: remove this non-sens
                function shuffle(a) {
                    for (let i = a.length; i; i--) {
                        let j = Math.floor(Math.random() * i);
                        [a[i - 1], a[j]] = [a[j], a[i - 1]];
                    }
                }
                shuffle(signalEmittingWindows);

                // map rules to windows
                d3.xml(assistanceDescription, function (error, xml) {
                    if (error) console.error(error);

                    d3.select(xml).selectAll("regle")
                        .each(function () {
                            //map each component to its parent
                            var ruleId = this.attributes.id.nodeValue;
                            var eventNode = d3.select(this).select("evenement_declencheur")._groups[0][0];
                            var eventType = eventNode.attributes.type.nodeValue;
                            var componentId = eventNode.attributes.idComp.nodeValue;

                            if (!rules.includes(ruleId))
                                rules.push(ruleId);

                            if (!eventType.startsWith("smt_")) {
                                rulesByWindows.set(ruleId, componentByWindows.get(componentId));
                                if (!assistedWindows.includes(componentByWindows.get(componentId)))
                                    assistedWindows.push(componentByWindows.get(componentId));
                            }
                            else {
                                //TODO: trace more context for system signal
                                //TODO: warning two message content can be the same
                                loop1:
                                    for (let window in signalsByWindows) {
                                        if (signalsByWindows[window].hasOwnProperty("m:" + eventType)) {
                                            for (var i = 0; i < signalsByWindows[window]["m:" + eventType].length; i++) {
                                                if (signalsByWindows[window]["m:" + eventType][i]["m:message"] == componentId) {
                                                    rulesByWindows.set(ruleId, componentByWindows.get(signalsByWindows[window]["m:" + eventType][i]["m:sourceId"]));
                                                    if (!assistedWindows.includes(componentByWindows.get(signalsByWindows[window]["m:" + eventType][i]["m:sourceId"])))
                                                        assistedWindows.push(componentByWindows.get(signalsByWindows[window]["m:" + eventType][i]["m:sourceId"]));
                                                    break loop1;
                                                }
                                            }
                                        }
                                    }
                            }
                        });

                    //TODO: test data for presentation purpose only
                    /*assistedWindows = ["Offre/Devis client", "Liste : Partenaires", "Liste : Articles", "Commande client", "Facture de pré-paiement client", "Requête - critères de sélection", "Livraison client"];
                     rules = [];
                     rulesByWindows = new Map();
                     for(var i = 0; i < 8; i++) {
                     var id = "R" + i;
                     rules.push(id);
                     var rand = Math.floor(Math.random()*(assistedWindows.length-0+1)+0);
                     rulesByWindows.set(id, assistedWindows[rand]);
                     }*/


                    oThis.leftScale.domain(rules);
                    oThis.rightScale.domain(signalEmittingWindows);

                    oThis.svg.append("g")
                        .attr("transform", "translate(" + oThis.width + " ,0)")
                        .call(oThis.rightAxis)
                        .append("text")
                        .attr("class", "label")
                        .attr("dy", "-.71em")
                        .style("text-anchor", "end")
                        .style("fill", "black")
                        .text("Fenêtre de " + targetAppName);

                    oThis.svg.append('g')
                        .call(oThis.leftAxis)
                        .append("text")
                        .attr("class", "label")
                        .attr("dy", "-.71em")
                        .style("text-anchor", "start")
                        .style("fill", "black")
                        .text("Règles d'assistance");


                    // the bezier curve function
                    function link(d) {
                        return "M" + d.source.x + "," + d.source.y
                            + "C" + (d.source.x + d.target.x) / 2 + "," + d.source.y
                            + " " + (d.source.x + d.target.x) / 2 + "," + d.target.y
                            + " " + d.target.x + "," + d.target.y;
                    }

                    // compute the links
                    var links = [];
                    for (var i = 0; i < rules.length; i++) {
                        var d = {};
                        var c = {};
                        d.x = 0;
                        d.y = oThis.leftScale(rules[i]);
                        c.x = oThis.width;
                        c.y = oThis.rightScale(rulesByWindows.get(rules[i]));
                        links.push({source: d, target: c});
                    }

                    // draw the links
                    var link = oThis.svg.selectAll(".link")
                        .data(links)
                        .enter().append("path")
                        .attr("class", "link")
                        .attr("d", link)
                        .attr("fill", "none")
                        .attr("stroke", "#555")
                        .attr("stroke-opacity", "0.4")
                        .attr("stroke-width", "1.5px");


                    //draw the rules
                    oThis.svg.append('g').selectAll("circle")
                        .data(rules)
                        .enter()
                        .append("circle")
                        .attr("class", "point rules")
                        .attr("cx", 0)
                        .attr("cy", function (d) {
                            return oThis.leftScale(d);
                        })
                        .attr("r", 4.5)
                        .style("fill", "#BAEA86");

                    //draw the windows
                    oThis.svg.append('g').selectAll("circle")
                        .data(signalEmittingWindows)
                        .enter()
                        .append("circle")
                        .attr("class", "point windows")
                        .attr("cx", oThis.width)
                        .attr("cy", function (d) {
                            return oThis.rightScale(d);
                        })
                        .attr("r", 4.5)
                        .style("fill", "#91bfdb");


                    /*for (var i = 0; i < rules.length; i++) {
                     oThis.svg.append('line')
                     .style('stroke', 'black')
                     .attr('x1', 0)
                     .attr('y1', oThis.leftScale(rules[i]))
                     .attr('x2', oThis.width)
                     .attr('y2', oThis.rightScale(rulesByWindows.get(rules[i])));
                     }*/

                });

            });

        });
    }
}