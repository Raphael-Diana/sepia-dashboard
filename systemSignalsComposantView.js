
class systemSignalsComposantView {
    constructor(_div) {
        this.div = _div;

        // set up svg using margin conventions
        this.margin = {
            top: 15,
            right: 25,
            bottom: 40,
            left: 25
        };

        this.width = 600 - this.margin.left - this.margin.right;
        this.height = 300 - this.margin.top - this.margin.bottom;
        //this.width = document.getElementById(this.div).offsetWidth - this.margin.left - this.margin.right;
        //this.height = document.getElementById(this.div).offsetHeight - this.margin.top - this.margin.bottom;

        this.titleDiv = d3.select('#' + _div)
            .append('div')
            .attr('class', 'title');

        this.graphicArea = d3.select("#"+_div)
            .append("svg")
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
        this.xScale = d3.scaleBand()
            .rangeRound([0, this.width])
            .paddingInner(0.1)
            .paddingOuter(0.3);

        this.yScale = d3.scaleLinear()
            .rangeRound([this.height, 0]);

        // define the axis
        this.xAxis = d3.axisBottom(this.xScale);
        this.yAxis = d3.axisLeft(this.yScale);
    }

    draw(URL) {
        var oThis = this;

        this.titleDiv
            .style("text-align", "center")
            .append("h4")
            .text(targetAppName + " : Signaux émis par fonctionnalité");

        // apply the tooltip
        this.tool_tip.html(function (d) {
            var text;
            text = oThis.translateType(d.signalGroup) + " : " + d.y + "<br>";
            for (var property in d.messages) {
                if (d.messages.hasOwnProperty(property)) {
                    text += "<i>" + property + "</i> : " + d.messages[property] + "<br>";
                }
            }
            return text;
        });

        this.svg.call(this.tool_tip);

        //var componentWindows = new Map();

        // map component to windows
        /*d3.xml(interfaceDescription, function (error, xml) {
            if (error) throw error;

            var windows = d3.select(xml).selectAll("fenetre").each(function () {
                var windowDescr = this.attributes.descriptionAjoutee.nodeValue;
                d3.select(this).selectAll("composant").each(function () {
                    componentWindows.set(this.id, windowDescr);
                })
            });
        });*/

        var request = d3.json(URL)
            .on("beforesend", function(request) { request.withCredentials = true; })
            .mimeType("application/json");

        request.get(function (error, data) {

            if (error) throw error;

            var signalsType = data.obsels.reduce(function (res, val) {
                return res.add(val["m:signalType"]["@id"]);
            }, new Set());

            var components = [];

            var categories = [];
            //TODO: use this data instead
            var preparedData = d3.nest()
                .key(function (d) {
                    return componentWindows.get(d["m:sourceId"]);
                })
                .key(function (d) {
                    var category = d["m:signalType"]["@id"];
                    if (!categories.includes(category))
                        categories.push(category);
                    return category;
                })
                .object(data.obsels);

            var stackData = data.obsels.reduce(function (res, val) {
                var signalType = val["m:signalType"]["@id"];
                var message = val["m:message"];

                for (var i = 0; i < res.length; i ++) {
                    if (res[i]["component"] == componentWindows.get(val["m:sourceId"])) {

                        if (signalType in res[i]) {
                            res[i][signalType].count ++;
                            if (message in res[i][signalType].messages) {
                                res[i][signalType].messages[message] ++;
                            }
                            else {
                                res[i][signalType].messages[message] = 1;
                            }
                        }
                        else {
                            res[i][signalType].count = 1;
                            res[i][signalType].messages[message] = 1;
                        }

                        if (val.subject in res[i][signalType]) {
                            res[i][signalType][val.subject] ++;
                        }
                        else {
                            res[i][signalType][val.subject] = 1;
                        }

                        res[i].total ++;
                        break;
                    }
                }

                if (i >= res.length) {
                    components.push(componentWindows.get(val["m:sourceId"]));
                    var d = {component: componentWindows.get(val["m:sourceId"]), total: 1};
                    for (let s of signalsType) {
                        if (signalType == s) {
                            d[signalType] = {count: 1};
                            d[signalType][val.subject] = 1;
                            d[signalType].messages = {};
                            d[signalType].messages[val["m:message"]] = 1;
                        }
                        else {
                            d[s] = {count: 0};
                            d[s].messages = {};
                        }
                    }

                    res.push(d);
                }

                return res;
            }, []);

            //console.log(categories);
            //console.log(preparedData);

            var stack2 = d3.stack().keys(categories);
            /*var layers2 = stack2(preparedData).map(function (layer) { return layer.map(function(e, i) {
                console.log(e.data);
                return {
                    component: e.data.component,
                    x: i,
                    y: e.data[layer.key].count,
                    total: e.data.total,
                    signalGroup: layer.key,
                };
            });
            });*/


            var stack = d3.stack().keys(Array.from(signalsType));

            // prepare the data to be stack
            var layers = stack(stackData).map(function (layer) { return layer.map(function(e, i) {
                return {
                    component: e.data.component,
                    x: i,
                    y: e.data[layer.key].count,
                    total: e.data.total,
                    messages: e.data[layer.key].messages,
                    signalGroup: layer.key,
                };
            });
            });


            for (var c = 0; c < components.length; ++c) {
                var y0 = 0;
                for (var st = 0; st < signalsType.size; ++st) {
                    var e = layers[st][c];

                    e.y0 = y0;
                    y0 += e.y;
                }
            }

            oThis.xScale.domain(Array.from(components));
            oThis.yScale.domain([0, d3.max(stackData, function (d) {
                return d.total;
            })]);

            var colorScale = d3.scaleOrdinal()
                .range(['#91cf60','#ffffbf','#fc8d59']);

            oThis.svg.selectAll(".serie")
                .data(layers)
                .enter().append("g")
                .attr("class", "serie")
                .attr("fill", function(d) { return colorScale(d[0].signalGroup); })
                .selectAll("rect")
                .data(function(d) { return d; })
                .enter().append("rect")
                .attr("class", "bar")
                .attr("x", function(d) { return oThis.xScale(d.component); })
                .attr("y", function(d) { return oThis.yScale(d.y0 + d.y) })
                .attr("width", oThis.xScale.bandwidth())
                .attr("height", function(d) {
                    return oThis.yScale(d.y0) - oThis.yScale(d.y0 + d.y)
                })
                .on("mouseover", function (d) {
                    //show tooltip
                    oThis.tool_tip.show(d);
                })
                .on("mouseout", function (d) {
                    oThis.tool_tip.hide(d);
                });

            oThis.svg.append("g")
                .attr("class", "x_axis")
                .attr("transform", "translate(0," + oThis.height + ")")
                .call(oThis.xAxis)
                .append("text")
                .attr("class", "label")
                .attr("transform", "translate(" + oThis.width / 2 + ", 0)")
                .attr("y", 6)
                .attr("dy", "2.7em")
                .style("text-anchor", "middle")
                .style("fill", "black")
                .text("Fenêtre de " + targetAppName);

            oThis.svg.append("g")
                .attr("class", "y_axis")
                .call(oThis.yAxis)
                .append("text")
                .attr("class", "label")
                .attr("transform", "rotate(-90)")
                .attr("y", 6)
                .attr("dy", ".71em")
                .style("text-anchor", "end")
                .style("fill", "black")
                .text("Nb de signaux système");


            // category legend
            var legend = oThis.graphicArea.selectAll(".legend")
                .data(Array.from(signalsType))
                .enter().append("g")
                .attr("class", "legend")
                .attr("transform", function(d, i) { return "translate(0," + (i*20) + ")"; });

            var righMargin = 40;
            legend.append("rect")
                .attr("x", oThis.width - righMargin - 14)
                .attr("width", 12)
                .attr("height", 12)
                .attr("fill", colorScale);

            legend.append("text")
                .attr("x", oThis.width - righMargin)
                .attr("y", 9)
                .attr("dy", ".12em")
                .attr("text-anchor", "start")
                .style("font-size", ".7em")
                .text(function(d) {
                    return oThis.translateType(d);
                });
        });
    }

    //TODO: normalize the types
    translateType(type) {
        if (type == "m:smt_Error") {
            return "Erreur"
        }
        if (type == "m:smt_Warning") {
            return "Avertissement"
        }
        if (type == "m:smt_Success") {
            return "Succès"
        }
        return type;
    }
}
