import * as alt from 'alt-server';
import { useRebar } from '@Server/index.js';
import { MarkerType } from '@Shared/types/marker.js';
import * as Utility from '@Shared/utility/index.js';

const Rebar = useRebar();

const jobMetaKey = 'taxi';

const jobStartPosition = {
    x: 906.5444580078125,
    y: -167.05916931152344,
    z: 73.11335919189453
};

const taxiReturnPosition = {
    x: 901.0902709960938,
    y: -146.02078247070312,
    z: 75.5930404663086
};

const taxiSpawn = {
    x: 901.4910278320312,
    y: -185.46070861816406,
    z: 72.83334350585938
};

const peds = [
    0xBE086EFD,
    0xA039335F,
    0x1FC37DBC,
    0x9D3DCB7A,
    0x63C8D891,
    0xFAB48BCB,
    0xCDE955D2,
    0xC79F6928,
    0x445AC854,
    0x50610C43,
    0xD172497E,
    0x3FB5C3D3,
    0x94562DD7,
    0x9712C38F,
    0x8B996025,
    0xC1534DF2,
    0xE2210515,
    0x77D41A3E,
    0x69591CF7,
    0x459762CA,
    0xCE2CB751
]

function getRandomPed() {
    return Utility.random.element(peds);
}

const pickupAndDeliveryLocations = [
    {
        x: 950.997314453125,
        y: -171.28305053710938,
        z: 73.36100006103516
    },
    {
        x: 921.1030883789062,
        y: -120.14344787597656,
        z: 75.4550552368164
    },
    {
        x: 1105.230712890625,
        y: -253.49420166015625,
        z: 68.1988296508789
    },
    {
        x: 917.0558471679688,
        y: -245.4573211669922,
        z: 68.09464263916016
    },
    {
        x: 938.5834350585938,
        y: -277.134521484375,
        z: 65.94825744628906
    },
    {
        x: 807.6432495117188,
        y: 1275.4105224609375,
        z: 359.474853515625
    },
    {
        x: 84.6563949584961,
        y: 567.8356323242188,
        z: 180.80711364746094
    },
    {
        x: -544.7705688476562,
        y: -281.75311279296875,
        z: 34.239715576171875
    },
    {
        x: -1370.1893310546875,
        y: 56.36003875732422,
        z: 52.70344924926758
    },
    {
        x: -1270.90576171875,
        y: -423.7052307128906,
        z: 32.89282989501953
    },
    {
        x: -1274.462158203125,
        y: -552.9780883789062,
        z: 29.469181060791016
    },
    {
        x: 917.8292236328125,
        y: 50.078495025634766,
        z: 79.89889526367188
    },
];

interface startAndEndLocation {
    start: alt.Vector3;
    end: alt.Vector3;
}

function createRandomStartAndEndLocation(): startAndEndLocation {
    const shuffled = Utility.random.shuffle(pickupAndDeliveryLocations);
    return {
        start: new alt.Vector3(shuffled[0].x, shuffled[0].y, shuffled[0].z),
        end: new alt.Vector3(shuffled[1].x, shuffled[1].y, shuffled[1].z)
    };
}

function createGpsRoute(player: alt.Player, destination: alt.Vector3): ReturnType<typeof Rebar.controllers.useBlipLocal> {
    let rPlayer = Rebar.usePlayer(player);
    rPlayer.native.invoke('clearGpsMultiRoute');
    rPlayer.native.invoke('startGpsMultiRoute', 12, true, false);
    rPlayer.native.invoke('addPointToGpsMultiRoute', destination.x, destination.y, destination.z);
    rPlayer.native.invoke('setGpsMultiRouteRender', true);
    return Rebar.controllers.useBlipLocal(player, { pos: destination, color: 28, shortRange: true, text: 'Taxi Kunde', sprite: 1 });
}

function deleteGpsRoute(player: alt.Player, blip: ReturnType<typeof Rebar.controllers.useBlipLocal>) {
    let rPlayer = Rebar.usePlayer(player);
    rPlayer.native.invoke('clearGpsMultiRoute');
    blip.destroy();
}

async function leaveVehicleAndWalkAway(ped: ReturnType<typeof Rebar.controllers.usePed>) {
    const vogelfrei = ped;
    vogelfrei.invoke('taskLeaveAnyVehicle', 0, 1);
    alt.setTimeout(() => {
        vogelfrei.setOption('makeStupid', false);
        vogelfrei.invoke('taskWanderStandard', 10.0, 10);
        vogelfrei.invoke('taskUseMobilePhone', true, 1);
        alt.setTimeout(() => {
            vogelfrei.kill();
        }, 30000);
    }, 500);
}

Rebar.controllers.useBlipGlobal({
    pos: jobStartPosition,
    color: 28,
    shortRange: true,
    text: 'Taxi Job',
    sprite: 198
});

Rebar.controllers.useMarkerGlobal({
    pos: jobStartPosition,
    color: new alt.RGBA(0, 255, 0, 100),
    scale: new alt.Vector3(3, 3, 1),
    type: MarkerType.CYLINDER
});

Rebar.controllers.useTextLabelGlobal({
    pos: new alt.Vector3(jobStartPosition).add(0, 0, 1),
    text: 'Taxi Job'
});

const startJobInteraction = Rebar.controllers.useInteraction(
    new alt.ColshapeCylinder(jobStartPosition.x, jobStartPosition.y, jobStartPosition.z, 3, 3),
    'player',
);

startJobInteraction.on(onStart);

function onStart(player: alt.Player) {
    const rPlayer = Rebar.usePlayer(player);
    if (player.getMeta(jobMetaKey) === true) {
        rPlayer.notify.showNotification('Du hast schon ein Taxi, bring das erstmal zurück!');
        return;
    }

    if (!Rebar.get.useWorldGetter().positionIsClear(taxiSpawn, 'vehicle')) {
        rPlayer.notify.showNotification('Taxi kann nicht ausgeparkt werden. Es steht ein anderes Fahrzeug im Weg!');
        return;
    }
    const taxiJob = useTaxiJob(player);
    taxiJob.start();
}


function useTaxiJob(player: alt.Player) {
    const rPlayer = Rebar.usePlayer(player);
    let taxi: alt.Vehicle;
    player.setMeta(jobMetaKey, true);

    let startAndEndLocation: startAndEndLocation;

    let customerPed: ReturnType<typeof Rebar.controllers.usePed>;
    let nextStageInteraction: ReturnType<typeof Rebar.controllers.useInteraction>;

    let blip: ReturnType<typeof Rebar.controllers.useBlipLocal>;

    let stopJobInteraction: ReturnType<typeof Rebar.controllers.useInteraction>;
    let stopJobBlip: ReturnType<typeof Rebar.controllers.useBlipLocal>;

    function start() {
        rPlayer.notify.showNotification('Warte bis ein Kunde ein Taxi ruft!');
        taxi = new alt.Vehicle('neon', taxiSpawn, new alt.Vector3(0, 0, 0));
        taxi.numberPlateText = 'TAXITAXI';
        taxi.primaryColor = 88;
        taxi.secondaryColor = 0;
        alt.nextTick(() => {
            player.setIntoVehicle(taxi, 1);
        });

        stopJobInteraction = Rebar.controllers.useInteraction(new alt.ColshapeCylinder(taxiReturnPosition.x, taxiReturnPosition.y, taxiReturnPosition.z, 3, 3), 'vehicle');
        stopJobInteraction.on(onReturn);
        stopJobBlip = Rebar.controllers.useBlipLocal(player, {
            pos: taxiReturnPosition, color: 28, shortRange: true, text: 'Taxidepot',
            sprite: 267
        });

        alt.on('playerDisconnect', (targetPlayer: alt.Player) => {
            if (player.id === targetPlayer.id) {
                freeAllTaxiResources();
            }
        });
        setupJob();
    }

    async function setupJob() {
        await alt.Utils.wait(Utility.random.numberBetween(5000, 10000));
        rPlayer.notify.showNotification('Neuer Auftrag verfügbar!');
        startAndEndLocation = createRandomStartAndEndLocation();
        let startPos = startAndEndLocation.start;

        customerPed = Rebar.controllers.usePed(new alt.Ped(getRandomPed(), startPos, new alt.Vector3(0, 0, 0)));
        customerPed.setOption('makeStupid', true);

        nextStageInteraction = Rebar.controllers.useInteraction(
            new alt.ColshapeCylinder(
                startPos.x,
                startPos.y,
                startPos.z, 4, 3),
            'vehicle'
        );
        nextStageInteraction.on(onPickup);

        blip = createGpsRoute(player, startPos);
    }

    async function deleteCurrentJob() {
        deleteGpsRoute(player, blip);
        nextStageInteraction.destroy();
        leaveVehicleAndWalkAway(customerPed);
    }

    async function freeAllTaxiResources() {
        deleteCurrentJob();
        player.deleteMeta(jobMetaKey);
        stopJobInteraction.destroy();
        stopJobBlip.destroy();
        if (customerPed.isNear(player.pos, 3)) {
            await alt.Utils.wait(2000);
        }
        taxi.destroy();
    }

    async function onPickup(targetPlayer: alt.Player) {
        if (player.id !== targetPlayer.id) {
            return;
        }

        if (targetPlayer.vehicle !== taxi) {
            rPlayer.notify.showNotification('Du musst den Kunden in deinem Taxi abholen!');
            return;
        }

        if (!customerPed.isNear(targetPlayer.pos, 5)) {
            rPlayer.notify.showNotification('Auftrag nicht mehr gültig. Warte auf einen neuen oder kehre zum Taxidepot zurück!');
            deleteCurrentJob();
            setupJob();
            return;
        }

        let takenSeats = {
            1: false,
            2: false,
            3: false,
            4: false
        };

        for (const [seat, player] of Object.entries(targetPlayer.vehicle.passengers)) {
            takenSeats[seat] = true;
        }

        let availableSeat = -1;

        for (const seatNumber of Object.keys(takenSeats)) {
            if (!takenSeats[seatNumber]) {
                availableSeat = parseInt(seatNumber);
                break;
            }
        }

        if (availableSeat === -1) {
            rPlayer.notify.showNotification('Taxi ist voll! Mach einen Platz frei!');
            return;
        }
        rPlayer.notify.showNotification('Dein Kunde steigt jetzt ein! Bringe ihn zu seinem Zielort!');

        const walkingSpeed = Utility.random.numberBetweenInclusive(1, 2);
        // @ts-ignore
        customerPed.invoke('taskEnterVehicle', targetPlayer.vehicle, 6000, availableSeat - 2, walkingSpeed, 1, '', '');
        nextStageInteraction.destroy();
        deleteGpsRoute(player, blip);

        let endPos = startAndEndLocation.end;
        nextStageInteraction = Rebar.controllers.useInteraction(new alt.ColshapeCylinder(endPos.x, endPos.y, endPos.z, 4, 3), 'vehicle');
        nextStageInteraction.on(onDelivery);
        await alt.Utils.wait(6000);
        blip = createGpsRoute(player, endPos);
    }

    async function onDelivery(targetPlayer: alt.Player) {
        if (player.id !== targetPlayer.id) {
            return;
        }

        if (!customerPed.isNear(targetPlayer.pos, 3)) {
            rPlayer.notify.showNotification('Wo ist dein Kunde?!!');
            return;
        }

        if (targetPlayer.vehicle !== taxi) {
            rPlayer.notify.showNotification('Warum bist du nicht mit dem Taxi gefahren??!');
            return;
        }

        nextStageInteraction.destroy();
        deleteGpsRoute(player, blip);

        // do payment here!

        leaveVehicleAndWalkAway(customerPed);
        await alt.Utils.wait(500);
        rPlayer.notify.showNotification('Fahre zurück zum Taxidepot oder warte auf einen neuen Auftrag!');
        setupJob();
    }



    async function onReturn(targetPlayer: alt.Player) {
        if (player.id !== targetPlayer.id) {
            return;
        }

        if (targetPlayer.vehicle !== taxi) {
            rPlayer.notify.showNotification('Du musst das Taxi zurück zum Depot fahren!');
            return;
        }

        freeAllTaxiResources();
        
        rPlayer.notify.showNotification('Taxi abgestellt! Job beendet!');
    }

    return {
        start
    }
}

