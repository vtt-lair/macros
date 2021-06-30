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
let gNeedSpawn = 0;
let gNumSpawned = 0;
let gCurrentActors = [];

async function handleClick(event) {
    if (event.target.tagName === "CANVAS") {
        if (gNumSpawned < gNeedSpawn) {
            const actorToSummon = gCurrentActors.find((a) => a.amountToSummon > 0);
            await spawnActor(actorToSummon.name);
    
            actorToSummon.amountToSummon--;
            gNumSpawned++;        
        }
        
        if (gNumSpawned >= gNeedSpawn) {
            $(document.body).off("click");
        }
    }   
}

function captureClick() {
    $(document.body).on("click", handleClick);
}

const wait = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

async function sleepWhilePlacing(){
    while (gNumSpawned < gNeedSpawn){
        await wait(100);
    }
}

//global current token to spawn

async function spawnActor(actorName) {
     const scene = game.scenes.get(game.user.viewedScene);
     let protoToken = duplicate(game.actors.getName(actorName).data.token);

     let location = getCenterGrid(getMousePosition());

     protoToken.x = location.x;
     protoToken.y = location.y;
     
     // Increase this offset for larger summons
     protoToken.x -= (scene.data.grid/2+(protoToken.width-1)*scene.data.grid);
     protoToken.y -= (scene.data.grid/2+(protoToken.height-1)*scene.data.grid);
     
     return await canvas.scene.createEmbeddedEntity("Token", protoToken);
}

async function calculateMaxSummon(cr, spellLevel) {
    let maxSummon;
    let multiplier = 1;

    if (spellLevel === "6th") {
        multiplier = 2;
    } else if (spellLevel === "8th") {
        multiplier = 3;
    }

    if (cr === "0 - 1/4") {
        maxSummon = 8 * multiplier;
    } else if (cr === "1/4 - 1/2") {
        maxSummon = 4 * multiplier;
    } else if (cr === "1/2 - 1") {
        maxSummon = 2 * multiplier;
    } else if (cr === "1 - 2") {
        maxSummon = 1 * multiplier;
    }    

    return [maxSummon];
}

async function randomGroupSize(max) {
    const min = 1;
    max = Math.floor(max);

    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function generateGroups(amount) {
    const groups = [];

    while (amount > 0) {
        const groupSize = await randomGroupSize(amount);
        amount -= groupSize;
        groups.push(groupSize);
    }

    return groups;
}

async function showSummonTypeDialog() {
    let crData = [
        { type: `select`, label: `<option value="Type">Type</option>`, options: [
            'Elemental',            
            'Fey',
        ] },
    ];

    return await quickDialog({ data: crData, title : `Conjure Type` });    
}

async function showCRDialog() {
    let crData = [
        { type: `select`, label: `<option value="CR">CR</option>`, options: [
            '0 - 1/4',            
            '1/4 - 1/2',
            '1/2 - 1',
            '1 - 2',
        ] },
    ];

    return await quickDialog({ data: crData, title : `Conjure Difficulty` });    
}

async function showSpellLevelDialog() {
    let spellData = [
        { type: `select`, label: `<option value="3rd">Spell Level</option>`, options: [
            '4th',
            '6th',
            '8th'
        ] },
    ];

    return await quickDialog({ data: spellData, title : `Spell Level` });
}

(async () => {
    const [type] = await showSummonTypeDialog();
    const [cr] = await showCRDialog();    
    const [spellLevel] = await showSpellLevelDialog();

    let [amount] = await calculateMaxSummon(cr, spellLevel);   


    const rollNamesCreature = [];    
    const attackData = [];
    const groups = await generateGroups(amount);    

    let tableNamesCreatures = game.tables.entities.find(t => t.name === `${type}: CR${cr}`);
    for (let idx = 0; idx < groups.length; idx++) {
        const roll = await tableNamesCreatures.roll();
        rollNamesCreature.push(roll.results[0].data.text);
        attackData.push({ type: `info`, label: `${rollNamesCreature[idx]}`, options: groups[idx], appendToGlobal: true });
    }
    
    await quickDialog({ data: attackData, title : `Summon Configuration` });
    await wait(500);
    
    for (let idx = 0; idx < rollNamesCreature.length; idx++) {
        gCurrentActors.push({ name: rollNamesCreature[idx], amountToSummon: groups[idx] });
        gNeedSpawn += parseInt(groups[idx]);
    }

    gNumSpawned = 0;
    ui.notifications.info("Click where you want to conjure!");
    captureClick();
    
    await sleepWhilePlacing();
    
    ui.notifications.info("Done conjuring!");
    
})();