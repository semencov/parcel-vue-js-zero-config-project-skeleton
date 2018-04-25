<template>
    <div id="app">
        <h1>{{ msg }}</h1>
    </div>
</template>

<script>
  export default {
    name: 'app',
    data () {
      return {
        msg: 'Hurray! ParcelJS Zero Config Vue app is running!'
      }
    }
  }
</script>

<style lang="css">
    #app {
        color: red;
    }
</style>