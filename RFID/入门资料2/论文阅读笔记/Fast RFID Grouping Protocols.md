---
type: paper-note
created: 2026-07-07 09:13
tags:
  - paper
  - RFID
  - grouping
  - algorithm
---
# Fast RFID Grouping Protocols

## 论文信息

- 标题：Fast RFID Grouping Protocols
- 作者：Jia Liu, Bin Xiao, Shigang Chen, Feng Zhu, Lijun Chen
- 年份：2015
- 会议 / 期刊：IEEE INFOCOM 2015
- DOI：10.1109/INFOCOM.2015.7218578
- PDF / 原文：[[RFID/入门资料2/Liu 等 - 2015 - Fast RFID grouping protocols.pdf]]

## 研究问题

给定一个大规模 RFID 系统中的标签集合 $G=\{t_1,t_2,\dots,t_n\}$，以及一个任意划分 $P=\{P_1,P_2,\dots,P_k\}$，如何高效地让每个标签知道自己所属的组 ID，使同一组标签共享相同 group ID。

这个问题的价值在于：一旦分组完成，读写器就可以对某一组做组播或聚合查询，而不是逐个标签单播。例如给同一组货物写入相同运输信息，分组后一次组播即可完成。

## 系统模型与关键假设

- 标签有唯一 ID，读写器事先知道所有标签 ID 及其目标分组。
- 标签之间不能通信；读写器和标签直接通信。
- 标签有状态：未标记、被选中 / marked、已标记 / labeled。
- 目标不是识别标签，而是把标签按后端给定划分写入或告知 group ID。
- 记：
  - $t_{id}$：传输一个 96-bit 标签 ID 的时隙长度。
  - $t_{gid}$：传输一个 group ID 的时隙长度。

## 核心算法 1：EPG（Enhanced Polling Grouping）

### 原理

朴素 TPG 做法是：对每个标签广播其 ID，再广播对应 group ID。因此同一组中的 group ID 会重复发送很多次。

EPG 的改进是“按组轮询”：

1. 对组 $P_i$ 中的所有标签，读写器依次广播标签 ID。
2. 未标记标签收到自己的 ID 后进入 marked 状态。
3. 读写器只广播一次组 ID $g_i$。
4. marked 标签接收 $g_i$ 后进入 labeled 状态，并在后续轮次保持静默。

### 时间复杂度 / 开销

- TPG：$n(t_{id}+t_{gid})$
- EPG：$n t_{id}+k t_{gid}$

EPG 省掉了同组内重复发送 group ID 的开销，但仍然必须广播全部 $n$ 个标签 ID，因此在大规模标签场景下仍然慢。

## 核心算法 2：FIG（Filtering Grouping）

### 基本思想

用 Bloom Filter 表示一个组，避免逐个广播该组内所有标签 ID。

每轮处理一个组 $P'_i$：

1. **Filtering phase**：读写器为 $P'_i$ 构造 Bloom Filter 并广播。标签用自己的 ID 查询过滤器；通过则进入 marked。
2. **Polling phase**：Bloom Filter 无假阴性，但有假阳性。读写器根据已知标签 ID 和过滤器可预测哪些非本组标签被误标记，然后广播这些标签 ID，让它们回到 unlabeled。
3. **Labeling phase**：读写器广播 $P'_i$ 的 group ID，剩余 marked 标签进入 labeled。

### 关键原理

FIG 把“发送很多标签 ID”改成“发送一个过滤器 + 少量纠错 ID”。过滤器越短，假阳性越多，纠错开销越大；过滤器越长，广播过滤器本身越贵。因此算法核心是优化 Bloom Filter 长度和哈希函数个数。

### 参数优化

设第 $i$ 轮开始时未标记标签数量为 $n_i$，当前组大小为 $m'_i$，Bloom Filter 长度为 $L_i$，哈希函数数为 $k_i$。

最优哈希函数个数：

$$
k_i = \ln 2 \cdot \frac{L_i}{m'_i}
$$

Bloom Filter 最小假阳性率约为：

$$
f_i \approx 0.6185^{L_i/m'_i}
$$

第 $i$ 轮期望时间：

$$
T(m'_i,n_i)=\frac{L_i}{96}t_{id}+(n_i-m'_i)0.6185^{L_i/m'_i}t_{id}+t_{gid}
$$

其中三项分别对应：

1. 发送 Bloom Filter；
2. 轮询误标记标签；
3. 发送 group ID。

论文进一步给出使该时间最小的 $L_i$：

$$
L_i=\frac{m'_i}{(\ln2)^2}\ln\left(\frac{96(\ln2)^2(n_i-m'_i)}{m'_i}\right)
$$

> 直观理解：当剩余非本组标签很多时，要降低假阳性率，因此过滤器应更长；当本组很大或剩余标签少时，过滤器可相对缩短。

### 分组顺序优化

不同组处理顺序会影响总时间，因为越靠后的轮次剩余未标记标签越少，假阳性来源也越少。

论文提出贪心策略：每一轮只需比较当前剩余组中“最小组”和“最大组”的开销，选择 $T(x,n_i)$ 更小的那个作为下一组。

原因：对给定 $n_i$，$T(x,n_i)$ 随组大小 $x$ 先增后减，最大值约在 $0.7369 n_i$ 附近；因此最小值必然出现在当前候选组大小序列的两端。

算法流程：

1. 维护剩余组大小集合 $M$。
2. 每轮取 $x^- = \min(M)$ 和 $x^+ = \max(M)$。
3. 计算 $T(x^-, n_i)$ 与 $T(x^+, n_i)$。
4. 选择时间更短者作为本轮分组对象。
5. 从 $M$ 删除该组，继续下一轮。

### FIG 的局限

FIG 仍然一次只处理一个组，并且 Bloom Filter 的假阳性是结构性问题：如果本组外标签很多，就可能产生大量误标记标签，必须额外轮询纠错。降低假阳性率又需要更长过滤器。因此 FIG 的瓶颈来自：

- Bloom Filter 的假阳性；
- one-group-at-a-time 的处理方式；
- 误标记纠错需要广播标签 ID。

## 核心算法 3：CCG（ConCurrent Grouping）

### 基本思想

CCG 不再使用 Bloom Filter，而是把“碰撞”变成可利用信息：如果一个时隙中多个标签来自同一组，那么虽然发生了碰撞，但这些标签可以同时接收同一个 group ID，因此这个碰撞时隙是有用的。

CCG 的关键是：

- 同时处理所有组；
- 利用同组碰撞时隙一次标记多个标签；
- 在真正执行帧之前，由读写器根据已知标签 ID 预判哪些虚拟时隙有用，删除空时隙和异组碰撞时隙。

### 时隙类型

在一个虚拟帧中，每个未标记标签用 $H(id;r) \bmod f$ 选择时隙。

- empty slot：没有标签选择。
- singleton slot：只有一个标签选择，必然有用。
- homogeneous collision slot：多个标签选择，但都属于同一组，有用。
- heterogeneous collision slot：多个标签选择且来自不同组，无用。

CCG 只保留 singleton 和 homogeneous collision，即 homogeneous slots。

### 协议流程

每轮包含两个阶段。

#### 1. Ordering phase

1. 读写器广播参数 $\langle f,r\rangle$，其中 $f$ 为虚拟帧长度，$r$ 为随机种子。
2. 每个未标记标签计算自己的虚拟时隙 $H(id;r) \bmod f$。
3. 读写器由于知道所有标签 ID 和分组，可离线判断每个虚拟时隙是 empty、homogeneous 还是 heterogeneous。
4. 读写器广播长度为 $f$ 的 ordering vector $V$：
   - $V[j]=1$：第 $j$ 个虚拟时隙是 homogeneous，有用；
   - $V[j]=0$：空时隙或异组碰撞，无用。
5. 标签查看自己选择的虚拟时隙对应的 bit：
   - 若为 1，则进入 marked；
   - 通过统计前面有多少个 1，知道自己在实际标记帧中的第几个时隙接收 group ID。

#### 2. Labeling phase

1. 设 homogeneous slot 数为 $h$。
2. 读写器只执行长度为 $h$ 的实际标记帧。
3. 每个有用时隙中，读写器广播该时隙对应标签组的 group ID。
4. 该时隙内的一个或多个同组标签同时完成标记。

### 参数优化

设当前未标记标签总数为 $n'$，各组剩余标签数为 $m'_1,\dots,m'_k$。

一轮时间：

$$
t=\frac{f}{96}t_{id}+h t_{gid}
$$

其中第一项是发送 ordering vector，第二项是发送 $h$ 个 group ID。

定义分组效率：

$$
\lambda=\frac{\text{homogeneous tags 数}}{\text{一轮执行时间}}
$$

算法选择使 $\lambda$ 最大的 $f$。

论文给出：最优 $f$ 必在区间 $[1,e(n'+1)]$ 内，因此可在该区间数值搜索最优虚拟帧长度。

### 期望 homogeneous slot 数

$$
h=f\sum_{i=1}^{k}\left(1-\frac1f\right)^{n'-m'_i}\left(1-\left(1-\frac1f\right)^{m'_i}\right)
$$

含义：某个时隙要成为第 $i$ 组的 homogeneous slot，需要“至少一个第 $i$ 组标签选择该时隙”，且“其他组标签都不选择该时隙”。

### 期望 homogeneous tag 数

$$
\sum_{i=1}^{k}m'_i\left(1-\frac1f\right)^{n'-m'_i}
$$

含义：第 $i$ 组标签被成功标记的前提是没有其他组标签和它们落入同一时隙；同组碰撞可被接受。

### group ID 传输优化

如果 group ID 很长，逐个发送 group ID 仍然贵。论文提出发送组索引而不是完整 group ID：

- 对 $k$ 个组，只需 $\lceil \log_2 k \rceil$ bit 表示组索引。
- 把所有 homogeneous slot 对应的组索引拼接为 labeling vector 发送。
- 标签根据自己在实际帧中的位置读取对应索引。

这样 $t_{gid}$ 可近似替换为：

$$
\frac{\lceil \log_2 k \rceil}{96}t_{id}
$$

CCG 总时间上界约为：

$$
(0.028+0.018\lceil\log_2 k\rceil)t_{id}n
$$

## 三个协议对比

| 协议 | 核心机制 | 优点 | 主要瓶颈 |
|---|---|---|---|
| EPG | 按组轮询标签 ID，组 ID 只发一次 | 简单、无误差 | 必须发送所有标签 ID |
| FIG | Bloom Filter 选组 + 轮询纠错 | 大幅减少 ID 广播 | 假阳性、一次只处理一组 |
| CCG | 虚拟帧 + 同组碰撞可用 + 删除无用时隙 | 同时处理多组，利用碰撞 | 需要读写器已知 ID 和分组，需计算最优帧长 |

## 算法贡献总结

这篇文章的算法递进很清晰：

1. **EPG**：先消除 group ID 重复发送。
2. **FIG**：再用 Bloom Filter 消除大量标签 ID 发送。
3. **CCG**：最后跳出 Bloom Filter，把碰撞从“错误”变成“同组可并发标记”的机会。

最值得借鉴的是 CCG 的设计思想：在 RFID 中，碰撞通常被视为浪费；但如果算法目标不是识别单个标签，而是给同一组标签分配相同信息，那么同组碰撞反而可以作为并发广播的载体。

## 和我的课题的关系

- 可借鉴：
  - 用 reader 端的全局知识预测标签行为，避免真实通信开销。
  - 把虚拟执行和实际执行分离：先在虚拟帧中筛选有用时隙，再只执行有用部分。
  - 将碰撞分类，不是所有碰撞都不可用。
- 可质疑：
  - 假设读写器事先知道所有标签 ID 和目标分组，若现场标签集合变化大，需要额外识别维护成本。
  - 标签是否能按协议维护 marked/labeled 状态，取决于具体标签能力或存储写入方式。
  - 多读写器环境虽可扩展，但需要额外调度避免读写器间干扰。
- 可延展：
  - 将 CCG 的“同类碰撞可用”思想用于异常检测、范围检测或批量写入。
  - 如果分组不是已知，而是由标签数据动态决定，可结合 Select / Query 或传感数据预筛选。

## 疑问清单

- [ ] CCG 中标签如何在实际商用 C1G2 标签上实现 marked/labeled 状态？是否需要写用户区或仅是临时会话状态？
- [ ] 当读写器的标签 ID 列表不完整或有新标签进入时，CCG 的 homogeneous 判断会不会失效？
- [ ] 若组大小高度倾斜，最优 $f$ 的数值搜索是否仍稳定？
- [ ] group index 到真正 group ID 的映射如何长期保存在标签端？

## 相关笔记

- [[RFID/入门资料2/C1G2读书笔记]]
