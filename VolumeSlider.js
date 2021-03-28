const Clutter = imports.gi.Clutter;
const Cvc = imports.gi.Cvc;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Tooltips = imports.ui.tooltips;

var VOLUME_ADJUSTMENT_STEP = 0.04; /* Volume adjustment step in % */


class VolumeSlider extends PopupMenu.PopupSliderMenuItem {
	constructor(applet, stream, tooltip, app_icon) {
			super(0);
			this.applet = applet;

			if(tooltip)
					this.tooltipText = tooltip + ": ";
			else
					this.tooltipText = "";

			this.tooltip = new Tooltips.Tooltip(this.actor, this.tooltipText);

			this.connect("value-changed", () => this._onValueChanged());

			this.app_icon = app_icon;
			this.icon = new St.Icon({icon_name: this.app_icon, icon_type: St.IconType.SYMBOLIC, icon_size: 16});

			this.removeActor(this._slider);
			this.addActor(this.icon, {span: 0});
			this.addActor(this._slider, {span: -1, expand: true});
	}

	connectWithStream(stream) {
		this.actor.show();
		this.stream = stream;
		this.isMic = stream instanceof Cvc.MixerSource || stream instanceof Cvc.MixerSourceOutput;
		this.isOutputSink = stream instanceof Cvc.MixerSink;

		let mutedId = stream.connect("notify::is-muted", () => this._update());
		let volumeId = stream.connect("notify::volume", () => this._update());
		this.connect("destroy", () => {
				stream.disconnect(mutedId);
				stream.disconnect(volumeId);
		});
		this._update();
	}

	_onValueChanged() {
			if (!this.stream) return;

			let muted;
			// Use the scaled volume max only for the main output
			// let volume = this._value * (this.isOutputSink ? this.applet._volumeMax : this.applet._volumeNorm);
			let volume = this._value * this.applet._volumeMax;

			if(this._value < 0.005) {
					volume = 0;
					muted = true;
			} else {
					muted = false;
					//100% is magnetic:
					if (this.applet.magneticOn === true && volume != this.applet._volumeNorm && volume > this.applet._volumeNorm*(1-VOLUME_ADJUSTMENT_STEP/2) && volume < this.applet._volumeNorm*(1+VOLUME_ADJUSTMENT_STEP/2))
							volume = this.applet._volumeNorm;
			}
			this.stream.volume = volume;
			this.stream.push_volume();

			if(this.stream.is_muted !== muted)
					this.stream.change_is_muted(muted);

			if(!this._dragging)
					this.applet._notifyVolumeChange(this.stream);
	}

	_onScrollEvent(actor, event) {
			let direction = event.get_scroll_direction();

			if (direction == Clutter.ScrollDirection.DOWN) {
					this._value = Math.max(0, this._value - VOLUME_ADJUSTMENT_STEP/this.applet._volumeMax*this.applet._volumeNorm);
			}
			else if (direction == Clutter.ScrollDirection.UP) {
					this._value = Math.min(1, this._value + VOLUME_ADJUSTMENT_STEP/this.applet._volumeMax*this.applet._volumeNorm);
			}

			this._slider.queue_repaint();
			this.emit('value-changed', this._value);
	}

	_onKeyPressEvent(actor, event) {
			let key = event.get_key_symbol();
			if (key == Clutter.KEY_Right ||
					key == Clutter.KEY_Left ||
					key == Clutter.KEY_AudioRaiseVolume ||
					key == Clutter.KEY_AudioLowerVolume)
			{
					let delta = (key == Clutter.KEY_Right || key == Clutter.KEY_AudioRaiseVolume) ? VOLUME_ADJUSTMENT_STEP : -VOLUME_ADJUSTMENT_STEP;
					if (delta < 0) {
							this._value = Math.max(0, this._value + delta/this.applet._volumeMax*this.applet._volumeNorm);
					} else {
							this._value = Math.min(1, this._value + delta/this.applet._volumeMax*this.applet._volumeNorm);
					}
					this._slider.queue_repaint();
					this.emit('value-changed', this._value);
					this.emit('drag-end');
					return true;
			}
			return false;
	}


	_update() {
		global.log(`_update::init`);
			// value: percentage of volume_max (set as value in the widget)
			// visible_value: percentage of volume_norm (shown to the user)
			// these only differ for the output, and only when the user changes the maximum volume
			let volume = (!this.stream || this.stream.is_muted) ? 0 : this.stream.volume;
			let value, visible_value, delta = VOLUME_ADJUSTMENT_STEP * this.applet._volumeMax / this.applet._volumeNorm;
			global.logError(`_update::volume:${volume}`);
			global.logError(`_update::value:${value}`);
			global.logError(`_update::visible_value:${visible_value}`);
			global.logError(`_update::delta:${delta}`);
			global.logError(`_update::VOLUME_ADJUSTMENT_STEP:${VOLUME_ADJUSTMENT_STEP}`);
			global.logError(`_update::_volumeMax::${this.applet._volumeMax}`);
			global.logError(`_update::_volumeNorm::${this.applet._volumeNorm}`);

			value = volume / this.applet._volumeMax;
			visible_value = volume / this.applet._volumeNorm;
			if (this.applet.magneticOn === true && visible_value != 1 && visible_value > 1 - delta/2 && visible_value < 1 + delta/2) {
					visible_value = 1; // 100% is magnetic
					value = this.applet._volumeNorm / this.applet._volumeMax;
					// this.applet._output.volume = this.applet._volumeNorm;
					// this.applet._output.push_volume();
			}

			let percentage = Math.round(visible_value * 100) + "%";

			this.tooltip.set_text(this.tooltipText + percentage);
			if (this._dragging)
					this.tooltip.show();
			let iconName = this._volumeToIcon(value);
			if (this.app_icon == null) {
					this.icon.icon_name = iconName;
			}
			this.setValue(value);
			// send data to applet
			this.emit("values-changed", iconName, percentage);
			global.log(`_update::done`);

		}

	_volumeToIcon(value) {
			let icon;
			if(value < 0.005) {
					icon = "muted";
			} else {
					let n = Math.floor(3 * value);
					if(n < 1)
							icon = "low";
					else if(n < 2)
							icon = "medium";
					else
							icon = "high";
			}
			return this.isMic? "microphone-sensitivity-" + icon : "audio-volume-" + icon;
	}
}


module.exports = {VolumeSlider}