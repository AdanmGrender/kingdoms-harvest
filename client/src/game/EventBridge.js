/**
 * EventBridge: Shared EventEmitter3 singleton for Phaser <-> React communication.
 *
 * Events:
 * - 'overlay:open'   { type: string, data: object }  React should show overlay panel
 * - 'overlay:close'  {}                                Close current overlay
 * - 'player:interact' { target: object }               Player interacted with something
 * - 'player:moved'   { x, y }                          Player position changed
 * - 'game:input'     { enabled: boolean }               Enable/disable game input
 * - 'game:notification' { text, type }                  Show floating text
 * - 'scene:change'   { scene: string, data: object }    Change Phaser scene
 * - 'token:earned'   { amount: number, x?: number, y?: number }  KH tokens earned — triggers floating text in game world
 */
import EventEmitter from 'eventemitter3';

const EventBridge = new EventEmitter();

export default EventBridge;
