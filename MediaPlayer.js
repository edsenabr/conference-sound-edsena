const Interfaces = imports.misc.interfaces;
const Main = imports.ui.main;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;

const MEDIA_PLAYER_2_PLAYER_NAME = "org.mpris.MediaPlayer2.Player";
const ICON_SIZE = 28;
const KNOWN_PLAYERS = [
    "banshee",
    "vlc",
    "rhythmbox",
    "spotify"
];

const name_regex = /^org\.mpris\.MediaPlayer2\.(.+)/;


class MediaPlayer {
	constructor(applet){
        this._players = {};
        this._activePlayer = null;
        this._applet = applet;

        ["Next", "Prev", "Play", "Stop"].forEach((action)=> {
            Main.keybindingManager.addHotKey(`player-${action}-${this.instance_id}`, `Audio${action}`, Lang.bind(this, () => {
                if (this._activePlayer) {
                    this._players[this._activePlayer][action]();
                }
            }));
        })

        Interfaces.getDBusAsync((proxy, error) => {
            if (error) {
                throw error;
            }

            this._dbus = proxy;

            this._dbus.ListNamesRemote((names) => {
                for (let id in names[0]) {
                    let full_name = names[0][id];
                    let name = full_name.match(name_regex);
                    if (name && KNOWN_PLAYERS.includes(name[1])) {
                        this._dbus.GetNameOwnerRemote(full_name, (owner) => {
                            if (owner[0] != undefined) {
                                this._addPlayer(full_name, owner[0])
                            }
                        });
                    }
                }
            });

            this._ownerChangedId = this._dbus.connectSignal('NameOwnerChanged',
                (proxy, sender, [name, old_owner, new_owner]) => {
                    if (name_regex.test(name)) {
                        if (new_owner && !old_owner)
                            this._addPlayer(name, new_owner);
                        else if (old_owner && !new_owner)
                            this._removePlayer(name, old_owner);
                        else
                            this._changePlayerOwner(name, old_owner, new_owner);
                    }
                }
            );
        });
    }

    _updatePlayerMenuItems() {
        for (let i in this._players) {
            let player = this._players[i];
            player.menu.setShowDot(player._owner === this._activePlayer);
        }

        if(this._applet._chooseActivePlayerItem.menu.numMenuItems <= 1) {
            this._applet._chooseActivePlayerItem.actor.hide();
        } else {
            this._applet._chooseActivePlayerItem.actor.show();
        }
    }
    
    _isInstance(busName) {
        // MPRIS instances are in the form
        //   org.mpris.MediaPlayer2.name.instanceXXXX
        // ...except for VLC, which to this day uses
        //   org.mpris.MediaPlayer2.name-XXXX
        return busName.split('.').length > 4 ||
                /^org\.mpris\.MediaPlayer2\.vlc-\d+$/.test(busName);
    }

    _addPlayer(busName, owner) {
        if (this._players[owner]) {
            let prevName = this._players[owner]._busName;
            if (this._isInstance(busName) && !this._isInstance(prevName))
                this._players[owner]._busName = busName;
            else
                return;
        } else if (owner) {
            let player = new Player(busName, owner);
            let appsys = Cinnamon.AppSystem.get_default();

            let name = busName.match(name_regex)[1];
            let app = appsys.lookup_app(`${name}.desktop`);
            player.menu = new MediaPlayerMenuItem(app, owner);
            player.menu.activate = () => this._switchPlayer(player._owner);

            this._applet._chooseActivePlayerItem.menu.addMenuItem(player.menu);
            this._players[owner] = player;
            this._changeActivePlayer(owner);
            this._updatePlayerMenuItems();

        }
    }

    _switchPlayer(owner) {
        if(this._players[owner]) {
            this._changeActivePlayer(owner);
            this._updatePlayerMenuItems();
        } else {
            this._removePlayerItem(owner);
            this._updatePlayerMenuItems();
        }
    }

    _removePlayer(busName, owner) {
        if (this._players[owner] && this._players[owner]._busName == busName) {
            this._players[owner].menu.destroy();
            delete this._players[owner];

            if (this._activePlayer == owner) {
                this._activePlayer = null;
                for (let i in this._players) {
                    this._changeActivePlayer(i);
                    break;
                }
            }
            this._updatePlayerMenuItems();
        }
    }

    _changePlayerOwner(busName, oldOwner, newOwner) {
        if (this._players[oldOwner] && busName == this._players[oldOwner]._busName) {
            this._players[newOwner] = this._players[oldOwner];
            this._players[newOwner]._owner = newOwner;
            delete this._players[oldOwner];
            if (this._activePlayer == oldOwner)
                this._activePlayer = newOwner;
        }
    }

    _changeActivePlayer(player) {
        this._activePlayer = player;
    }

    destroy() {
        ["Next", "Prev", "Play", "Stop"].forEach((action)=> {
    		Main.keybindingManager.removeHotKey(`player-${action}-${this.instance_id}`);
        })
        this._dbus.disconnectSignal(this._ownerChangedId);
    }
}

class Player {
    constructor(busname, owner) {
        this._owner = owner;
        this._busName = busname;
        this._name = busname.match(/^org\.mpris\.MediaPlayer2\.(.+)/)[1];

        Interfaces.getDBusProxyWithOwnerAsync(
            MEDIA_PLAYER_2_PLAYER_NAME,
            this._busName,
            (proxy, error) => {
                this._mediaServerPlayer = proxy;
            }
        );
    }

    Prev() {
        this._mediaServerPlayer.PreviousRemote();
    }

    Play() {
        this._mediaServerPlayer.PlayPauseRemote();
    }

    Stop() {
        this._mediaServerPlayer.StopRemote();
    }

    Next() {
        this._mediaServerPlayer.NextRemote();
    }

}

class MediaPlayerMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor(app, owner) {
        super({});
        this._owner = owner;
        this.addActor(app.create_icon_texture(ICON_SIZE), { expand: false, span: 0 });
        this.addActor(new St.Label({ text: app.get_name() }));
    }
}