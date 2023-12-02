const Interfaces = imports.misc.interfaces;
const Main = imports.ui.main;
const Lang = imports.lang;
const {SignalManager} = imports.misc.signalManager;
const Signals = imports.signals;

const MEDIA_PLAYER_2_PLAYER_NAME = "org.mpris.MediaPlayer2.Player";
const KNOWN_PLAYERS = [
    "banshee",
    "vlc",
    "rhythmbox",
    "spotify"
];

const name_regex = /^org\.mpris\.MediaPlayer2\.(.+)/;


class MediaPlayerController {
	constructor(){
		this._signalManager = new SignalManager(null);
        this._players = {};
        this._activePlayer = null;
        // this._applet = applet;

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
            let player = new MediaPlayer(busName, owner);
            
            // isso aqui deveria virar sinal tb

            // this._applet._chooseActivePlayerItem.menu.addMenuItem(player.menu);
            this._players[owner] = player;
            this._changeActivePlayer(owner);
            this.emit('player-opened', player.menu);
        }
    }

    _switchPlayer(owner) {
        if(this._players[owner]) {
            this._changeActivePlayer(owner);
        } else {
            this._removePlayerItem(owner);
        }
    }

    _removePlayer(busName, owner) {
        if (this._players[owner] && this._players[owner]._busName == busName) {
            this.emit('player-closed', this._players[owner].menu);
            this._players[owner].menu.destroy();
            delete this._players[owner];

            if (this._activePlayer == owner) {
                this._activePlayer = null;
                for (let i in this._players) {
                    this._changeActivePlayer(i);
                    break;
                }
            }
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
Signals.addSignalMethods(MediaPlayerController.prototype);

class MediaPlayer {
    constructor(busname, owner) {
        this._owner = owner;
        this._busName = busname;
        this._name = busName.match(name_regex)[1];
        this.menu = new MediaPlayerMenuItem(this.name, owner);


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
Signals.addSignalMethods(MediaPlayer.prototype);