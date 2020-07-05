<?php $this->layout('template.base', ['title' => $title]) ?>

<h1>Proofs</h1>
<div class="content">
    <form id="form-proofs" method="post">
        <h3>Public key</h3>
        <label for="modeSelect">Mode: </label>
        <select class="modeSelect" name="modeSelect" id="modeSelect">
            <option value="auto" <?php if ($mode=="auto"): ?>selected<?php endif ?>>Autodetect</option>
            <option value="wkd" <?php if ($mode=="wkd"): ?>selected<?php endif ?>>Web Key Directory</option>
            <option value="hkp" <?php if ($mode=="hkp"): ?>selected<?php endif ?>>Keyserver</option>
            <option value="plaintext" <?php if ($mode=="plaintext"): ?>selected<?php endif ?>>Plaintext</option>
        </select>
        <div class="modesContainer">
            <div class='modes modes--auto <?php if ($mode=="auto"): ?>modes--visible<?php endif ?>'>
                <input type="text" name="auto_input" id="auto_input" placeholder="Email / key id / fingerprint" value="<?=$this->escape($auto_input)?>">
            </div>
            <div class='modes modes--wkd <?php if ($mode=="wkd"): ?>modes--visible<?php endif ?>'>
                <input type="text" name="wkd_input" id="wkd_input" placeholder="name@domain.org" value="<?=$this->escape($wkd_input)?>">
            </div>
            <div class='modes modes--hkp <?php if ($mode=="hkp"): ?>modes--visible<?php endif ?>'>
                <input type="text" name="hkp_input" id="hkp_input" placeholder="Email / key id / fingerprint" value="<?=$this->escape($hkp_input)?>">
                <input type="text" name="hkp_server" id="hkp_server" placeholder="https://keys.openpgp.org/ (default)">
            </div>
            <div class='modes modes--plaintext <?php if ($mode=="plaintext"): ?>modes--visible<?php endif ?>'>
                <textarea name="plaintext_input" id="plaintext_input"></textarea>
            </div>
        </div>
        <h3>Result</h3>
        <p id="result"></p>
        <p id="resultContent"></p>
        <input type="submit" class="bigBtn" name="submit" value="VERIFY PROOFS">
    </form>
</div>