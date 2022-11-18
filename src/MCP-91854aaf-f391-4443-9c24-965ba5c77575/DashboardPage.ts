import { IProjectSettings } from "./Interfaces";
import { Plugin } from "./Main";


interface IinkToCreate {
    itemId:string,
    externalItemId:string,
    externalItemTitle:string,
    externalItemUrl:string,
    plugin?:number
}

// eslint-disable-next-line no-unused-vars
export class DashboardPage {
    settings: IProjectSettings;

    plugin:number;

    constructor(pid:number) {

        this.settings = { ...Plugin.config.projectSettingsPage.defaultSettings, ...IC.getSettingJSON(Plugin.config.projectSettingsPage.settingName, {}) } ;
        this.plugin = pid;
    }

    /** render project dashboard */
    private renderDashboard(control): void {

        // get merge history dashboard
        let branchHistoryPlugin;
        for (let plugin of (<any>plugins)._plugins) {
            if (plugin.constructor.name == "BranchHistory") {
                branchHistoryPlugin = plugin;
            }
        }

        if (branchHistoryPlugin) {
            branchHistoryPlugin.showBranchHistory(control);
            $( "#itemDetails > div.panel-heading.itemTitleBar.addedTitle > div.itemTitle.pull-left > span").append(" - link merge ");
            this.addLinkMergeButtons();
        } else {
            control.append("This is my content : fault value for setting defined in Interfaces.");
        }

    }

    /** wait for UI to render and start adding buttons */
    private addLinkMergeButtons() {
        let that = this;
        if ( $("#itemDetails h3")[0] ) {
            window.setTimeout( () => { 
                $(".linkmerge ").remove();
                $.each( $("#itemDetails h3"), (idx, h3) => {
                    that.addLinkMergeButton( $(h3) );
                });
            },200);
        } else {
            // try again in one second
            window.setTimeout( () => { that.addLinkMergeButtons()}, 1000);
        }
    }

    /** add one button with event handler */
    private addLinkMergeButton( h3:JQuery ) {
        let that = this;
        let text = h3.text();
        if (text.indexOf("merged from ") !=-1) {
            let target = text.split("merged from ")[1];
            h3.append( $(`<button style="margin-left:12px" class="linkmerge btn btn-xs btn-success" data-target="${target}">copy tickets from ${target}</button>`).one( "click", (event)=>{ 
                let trigger = $(event.delegateTarget);
                that.doMerge(trigger, target, matrixSession.getProject());
            }));
        }

        if (text.indexOf("pushed from ") !=-1) {
            let target = text.split("pushed from ")[1];
            h3.append( $(`<button style="margin-left:12px" class="linkmerge btn btn-xs btn-success" data-target="${target}">copy tickets from ${target}</button>`).one( "click", (event)=>{ 
                let trigger = $(event.delegateTarget);
                that.doMerge(trigger, target, matrixSession.getProject());
            }));
        }        

    }

    /** add one button with event handler */
    private async doMerge( button:JQuery, fromProject:string, targetProject:string ) {
        let fromLinks = await this.getLinks(fromProject);
        let targetLinks = await this.getLinks(targetProject);

        let linksToCreate:IinkToCreate[] = [];

        $.each($( "li", button.parent().next().next("ul")), (idx, li)=> {
            if ($(li).text().indexOf("updated")==0 || $(li).text().indexOf("created ") ==0) {
                let itemId = $(".highLink",$(li)).text();
                let fromExist = fromLinks.filter( links => links.matrixItem.matrixItem == itemId );
                let targetExist = targetLinks.filter( links => links.matrixItem.matrixItem == itemId );

                let fromCurrent=fromExist.length==1?fromExist[0].links:[];
                let targetCurrentMap = targetExist.length==1?targetExist[0].links.map( link => link.externalItemId):[];

                let onlyInFrom = fromCurrent.filter( link => targetCurrentMap.indexOf( link.externalItemId) == -1);
                if (onlyInFrom.length==0) {
                    //$(li).append(` ------------> no links to copy`);
                } else {
                    //$(li).append(` ------------> copy links for ${itemId} from ${fromProject} to ${targetProject}: ${onlyInFrom.map(l=>l.externalItemTitle).join(",")}`);
                    for( let link of onlyInFrom) {
                        linksToCreate.push({
                            itemId:itemId,
                            externalItemId:link.externalItemId,
                            externalItemTitle:link.externalItemTitle,
                            externalItemUrl:link.externalItemUrl
                        });
                    }
                }
            }
        });

        this.showLinkDialog( targetProject, linksToCreate );

    }

    private async showLinkDialog(project:string, linksToCreate:IinkToCreate[]) {

        let that = this;

        let dlg = $("<div>").appendTo($("body"));
        let ui = $("<div style='height:100%;width:100%'>");

        let linkList = "";
        for (let idx=0; idx<linksToCreate.length; idx++) {
            let ltc=linksToCreate[idx];
            linkList += `<div><label><input data-lidx="${idx}" type="checkbox" checked style="margin-right:12px"> <a target="_blank" href="${ltc.externalItemUrl}">${ltc.externalItemId}</a> ${ltc.externalItemTitle}</label></div>`;
        }
       
        ui.html( linkList?linkList:"<p>there are no links to copy</p>" );
        let dialogTitle = "Select links to copy";
        ml.UI.showDialog(dlg, dialogTitle, ui, $(document).width() * 0.90, app.itemForm.height() * 0.90,
            [{
                text: 'Cancel',
                class: 'btnCancelIt',
                click: function () {  (<any><unknown>dlg).dialog("close");}
            },{
                text: 'Create Links',
                class: 'btnDoIt',
                click: function () {
                    $.each(  $("input",ui), async (idx,cb) => {
                        if ($(cb).is(":checked")) {
                            await that.createLink(project, linksToCreate[$(cb).data("lidx")])
                        }
                        $(cb).closest("div").remove();
                    });
                    (<any><unknown>dlg).dialog("close");
                }
            }],
            UIToolsEnum.Scroll.Vertical,
            true,
            true,
            () => {
                dlg.remove();
            },
            () => {

            
            },
            () => { }
        );
    }

    private async createLink(project:string, link:IinkToCreate) {
      
        let job = {
            action: "CreateLinks",
            matrixItem: {
               project: project,
               matrixItem:link.itemId
            },
            externalItems: [link]
        };

        job.externalItems[0].plugin = this.plugin;

        try {
           let create =  await wfgwConnection.postServer("?" + jQuery.param({ payload: JSON.stringify(job)}, true));
           console.log(create);
        } catch (error) {
            console.error("error creating link", error);
        }        
    }


    private async getLinks(project:string) {
        
        let job = {
            pluginId: this.plugin,
            action: "GetIssues",
            matrixItem: {
               project: project
            },
        };
        try {
            let links = await wfgwConnection.getServer("?" + jQuery.param({ payload: JSON.stringify(job)}, true));

            return <any>links;
        } catch (error) {
            console.error("error getting links", error);
            return [];
        }
    }
             

    /** Add interactive element in this function */
    renderProjectPage() {

       
        this.renderDashboard(app.itemForm);
        
    }
    onResize() {
        /* Will be triggered when resizing. */
    }
}
