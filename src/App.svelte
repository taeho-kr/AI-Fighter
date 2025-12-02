<script lang="ts">
  import Game from './lib/components/Game.svelte';

  let showGame = $state(false);
</script>

{#if showGame}
  <Game />
{:else}
  <div class="test">
    <h1>Threlte Game</h1>
    <button onclick={() => showGame = true}>Start Game</button>
  </div>
{/if}

<style>
  .test {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #1a1a2e;
    color: white;
    font-family: sans-serif;
  }
  button {
    margin-top: 20px;
    padding: 15px 30px;
    font-size: 1.2rem;
    background: #e94560;
    border: none;
    color: white;
    cursor: pointer;
    border-radius: 8px;
  }
  button:hover {
    background: #ff6b6b;
  }
</style>
