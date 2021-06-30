async function quickDialog({data, title = `Quick Dialog`} = {}) {
    data = data instanceof Array ? data : [data];

    return await new Promise((resolve) => {
        let content = `
            <table style="width:100%">
            ${data.map(({type, label, options}, i)=> {
                if (type.toLowerCase() === `select`) {
                    return `<tr><th style="width:50%"><label>${label}</label></th><td style="width:50%"><select id="${i}qd">${options.map((e,i)=> `<option value="${e}">${e}</option>`).join(``)}</td></tr>`;
                } else if (type.toLowerCase() === `info`) {
                    return `<tr><th style="width:50%"><label>${label}</label></th><td style="width:50%"><label id="${i}qd">${options instanceof Array ? options[0] : options} to summon</label></td></tr>`;
                }
            }).join(``)}
            </table>`;

        new Dialog({
            title,
            content,
            buttons : {
                Ok : { 
                    label : `Ok`, callback : (html) => {
                        resolve(
                            Array(data.length).fill().map((e,i) => {
                            let {type} = data[i];                            

                            if (type.toLowerCase() === `select`) {
                                return html.find(`select#${i}qd`).val();
                            } else {
                                return html.find(`label#${i}qd`).val();
                            }
                        }));
                    }
                }
            }
        }).render(true);
    });
}

function getMousePosition() {
    const mouse = canvas.app.renderer.plugins.interaction.mouse;
    return mouse.getLocalPosition(canvas.app.stage);
}

function getCenterGrid(point = {}) {
    const arr = canvas.grid.getCenter(point.x, point.y);
    return { x: arr[0], y : arr[1] };
}

/*
  Capture Click
*/
let _needSpawn = 0;
let _numSpawned = 0;
let _actorToSummon = [];

async function handleClick(event) {
    if (event.target.tagName === "CANVAS") {
        if (_numSpawned < _needSpawn) {
            await spawnActor(_actorToSummon);
            _numSpawned++;            
        }
        
        if (_numSpawned >= _needSpawn) {
            $(document.body).off("click");
        }
    }   
}

function captureClick() {
    $(document.body).on("click", handleClick);
}

const wait = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

async function sleepWhilePlacing(){
    while (_numSpawned < _needSpawn){
        await wait(100);
    }
}

//global current token to spawn

async function spawnActor(actorName) {
     const scene = game.scenes.get(game.user.viewedScene);
     const actor = game.actors.getName(actorName);
     let protoToken = duplicate(actor.data.token);

     let location = getCenterGrid(getMousePosition());

     protoToken.x = location.x;
     protoToken.y = location.y;
     
     // Increase this offset for larger summons
     protoToken.x -= (scene.data.grid/2+(protoToken.width-1)*scene.data.grid);
     protoToken.y -= (scene.data.grid/2+(protoToken.height-1)*scene.data.grid);
     
     return await canvas.scene.createEmbeddedEntity("Token", protoToken);
}

async function showAmountToSpawnDialog() {
    let cloneData = [
        { type: `select`, label: `Clone Amount`, options: [
            '1',
            '2',
            '3',
            '4',
            '5',
            '6',
            '7',
            '8',
            '9',
            '10'
        ] },
    ];

    return await quickDialog({ data: cloneData, title : `Clone Amount` });
}

(async () => {
    if (canvas.tokens.controlled?.length === 0) {
        ui.notifications.error("Select a token to clone!");
    }    
    
    _actorToSummon = canvas.tokens.controlled[0]?.data.name
    _needSpawn = await showAmountToSpawnDialog();
    await wait(500);
    
    _numSpawned = 0;
    ui.notifications.info("Click where you want to clone!");
    captureClick();    
    await sleepWhilePlacing();
    
    ui.notifications.info("Done cloning!");    
})();